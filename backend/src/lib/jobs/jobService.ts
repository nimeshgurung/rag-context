import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import slug from 'slug';
import PQueue from 'p-queue';
import { db } from '../db';
import { embeddingJobs } from '../schema.js';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { WebScrapeSource } from '../types';
import { crawlSource } from '../crawl/crawler';
import { ragService } from '../rag/service';
import { sendEvent } from '../events';
import { fetchMarkdownForUrl } from '../crawl/contentFetcher';

// Type for the raw embedding job row from database
interface EmbeddingJobRow extends Record<string, unknown> {
  id: number;
  job_id: string;
  library_id: string;
  library_name: string | null;
  library_description: string | null;
  source_url: string;
  custom_enrichment_prompt: string | null;
}

export interface EmbeddingJobPayload {
  id?: number; // The database row ID for the job
  jobId?: string;
  libraryId: string;
  libraryName: string;
  libraryDescription: string;
  sourceUrl: string;
  customEnrichmentPrompt?: string;
}

export interface JobBatch {
  jobId: string;
  createdAt: Date;
  jobs: {
    id: number;
    sourceUrl: string;
    status: string;
    processedAt: Date | null;
    errorMessage: string | null;
  }[];
  summary?: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

/**
 * Job Service for managing embedding jobs and queue processing.
 *
 * Handles job creation, processing, status tracking, and queue management
 * with rate limiting and batch processing capabilities.
 *
 * IMPORTANT: Understanding the Two Types of IDs
 * ============================================
 *
 * This service works with TWO different types of IDs that are often confused:
 *
 * 1. Database Row ID (integer): Auto-increment primary key (1, 2, 3, 4...)
 *    - Used by: processSingleJob(jobItemId: number)
 *    - Identifies: ONE specific URL in the embedding_jobs table
 *    - Example: processSingleJob(3) processes just the URL in row 3
 *
 * 2. Crawl Batch ID (UUID string): Groups URLs from the same crawl operation
 *    - Used by: processAllJobs(jobId: string), getCrawlJobStatus(jobId: string)
 *    - Identifies: ALL URLs discovered in a single crawl operation
 *    - Example: processAllJobs("abc-123-def-456") processes all URLs from that crawl
 *
 * Database Schema:
 * ---------------
 * embedding_jobs (
 *     id SERIAL PRIMARY KEY,           -- Row ID (integer)
 *     job_id UUID NOT NULL,           -- Crawl Batch ID (UUID string)
 *     source_url TEXT NOT NULL,       -- Individual URL
 *     library_id TEXT NOT NULL,       -- Library this belongs to
 *     raw_snippets JSONB,            -- Code snippets (for code scraping)
 *     context_markdown TEXT,          -- Raw markdown (for documentation scraping)
 *     status VARCHAR(20)              -- pending/processing/completed/failed
 * )
 *
 * Example Data:
 * ------------
 * id | job_id                    | source_url              | scrape_type    | status
 * 1  | abc-123-def-456          | https://docs.com/page1  | documentation  | pending
 * 2  | abc-123-def-456          | https://docs.com/page2  | documentation  | completed
 * 3  | abc-123-def-456          | https://docs.com/page3  | code           | failed
 * 4  | xyz-789-ghi-012          | https://other.com/api   | documentation  | pending
 *
 * Method Usage Examples:
 * ---------------------
 * - processSingleJob(3)                 → Process just "https://docs.com/page3"
 * - processAllJobs("abc-123-def-456")   → Process all URLs from that crawl batch
 * - getCrawlJobStatus("abc-123-def-456") → Get status of all URLs in that batch
 *
 * Two-Phase Processing Flow:
 * -------------------------
 * Phase 1 - Crawling (Fast):
 *   1. User starts crawl → Creates crawl batch ID (UUID)
 *   2. Crawler discovers URLs → Scrapes content quickly
 *   3. Documentation: Store raw markdown in context_markdown
 *   4. Code: Store code snippets in raw_snippets
 *   5. Create embedding_jobs rows with status='pending'
 *
 * Phase 2 - Processing (On-demand, LLM-intensive):
 *   6. User triggers processing → System fetches pending jobs
 *   7. Documentation: Split markdown → LLM semantic extraction
 *   8. Code: LLM enrichment of code snippets
 *   9. Create embeddings → Store in vector database
 *   10. Mark jobs as completed
 *
 * Benefits:
 * - Crawling phase is fast and doesn't timeout on large pages
 * - Processing phase can be triggered on-demand or in background
 * - Failed processing doesn't require re-crawling
 */
class JobService {
  private queue: PQueue;
  private readonly RATE_LIMIT_PER_MINUTE: number;
  private readonly BATCH_SIZE: number;
  private readonly CONCURRENCY: number;
  private shouldShutdown = false;

  constructor() {
    this.RATE_LIMIT_PER_MINUTE = process.env.EMBEDDING_RATE_LIMIT
      ? parseInt(process.env.EMBEDDING_RATE_LIMIT, 10)
      : 20;
    this.BATCH_SIZE = 10;
    this.CONCURRENCY = 5;

    this.queue = new PQueue({
      concurrency: this.CONCURRENCY,
      interval: 60 * 1000, // 1 minute
      intervalCap: this.RATE_LIMIT_PER_MINUTE,
    });
  }

  shutdown() {
    console.log('Shutting down JobService...');
    this.shouldShutdown = true;
    this.queue.clear();
  }

  private async interruptibleSleep(ms: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < ms && !this.shouldShutdown) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Check every 100ms
    }
  }

  /**
   * Enqueue multiple embedding jobs into the database.
   */
  async enqueueEmbeddingJobs(jobs: EmbeddingJobPayload[]): Promise<void> {
    if (jobs.length === 0) {
      return;
    }

    try {
      await db.transaction(async (tx) => {
        // Prepare the data for bulk insert with proper null handling
        const jobData = jobs.map((job) => ({
          jobId: job.jobId || '',
          libraryId: job.libraryId,
          libraryName: job.libraryName,
          libraryDescription: job.libraryDescription,
          sourceUrl: job.sourceUrl,

          customEnrichmentPrompt: job.customEnrichmentPrompt || null,
        }));

        // Bulk insert using Drizzle
        await tx.insert(embeddingJobs).values(jobData);
      });

      console.log(`Enqueued ${jobs.length} embedding jobs.`);
    } catch (error) {
      console.error('Error enqueuing embedding jobs:', error);
      throw error;
    }
  }

  /**
   * Fetch pending embedding jobs from the database with optional filtering by crawl batch ID.
   *
   * @param limit - Maximum number of jobs to fetch
   * @param jobId - Optional crawl batch ID (UUID string) to filter by. If provided,
   *                only fetches pending jobs from that specific crawl batch.
   * @returns Promise with array of pending jobs, automatically marked as 'processing'
   *
   * Example: fetchPendingJobs(10, "abc-123-def-456") gets up to 10 pending jobs
   *          from that specific crawl batch
   */
  private async fetchPendingJobs(
    limit: number,
    jobId?: string,
  ): Promise<(EmbeddingJobPayload & { id: number })[]> {
    try {
      return await db.transaction(async (tx) => {
        // Complex query with row locking requires raw SQL
        let query = sql`
          SELECT *
          FROM embedding_jobs
          WHERE status = 'pending'
        `;

        if (jobId) {
          query = sql`
            SELECT *
            FROM embedding_jobs
            WHERE status = 'pending' AND job_id = ${jobId}
            ORDER BY created_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          `;
        } else {
          query = sql`
            SELECT *
            FROM embedding_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          `;
        }

        const result = await tx.execute(query);
        const jobs = (result.rows as EmbeddingJobRow[]).map((row) => ({
          id: row.id,
          jobId: row.job_id,
          libraryId: row.library_id,
          libraryName: row.library_name || '',
          libraryDescription: row.library_description || '',
          sourceUrl: row.source_url,
          customEnrichmentPrompt: row.custom_enrichment_prompt || undefined,
        }));

        if (jobs.length > 0) {
          const jobIds = jobs.map((j) => j.id);
          await tx
            .update(embeddingJobs)
            .set({
              status: 'processing',
              processedAt: new Date(),
            })
            .where(inArray(embeddingJobs.id, jobIds));
        }

        return jobs;
      });
    } catch (error) {
      console.error('Error fetching pending jobs:', error);
      throw error;
    }
  }

  /**
   * Mark a job as completed.
   */
  private async markJobAsCompleted(jobId: number): Promise<void> {
    await db
      .update(embeddingJobs)
      .set({ status: 'completed' })
      .where(eq(embeddingJobs.id, jobId));
  }

  /**
   * Mark a job as failed with error details and type.
   * @param jobId - The job ID to mark as failed
   * @param errorMessage - The error message
   * @param errorType - Type of error: 'fetch' or 'processing'
   */
  private async markJobAsFailed(
    jobId: number,
    errorMessage: string,
    errorType: 'fetch' | 'processing' = 'processing',
  ) {
    await db
      .update(embeddingJobs)
      .set({
        status: 'failed',
        errorMessage: `[${errorType}] ${errorMessage}`,
        updatedAt: new Date(),
      })
      .where(eq(embeddingJobs.id, jobId));
  }

  /**
   * Mark a job as processing.
   */
  private async markJobAsProcessing(jobId: number) {
    await db
      .update(embeddingJobs)
      .set({
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(embeddingJobs.id, jobId));
  }

  /**
   * Process a job from the queue by fetching fresh content.
   * This is used by the batch processing queue.
   */
  private async processJob(
    job: EmbeddingJobPayload & { id: number },
  ): Promise<void> {
    let isFetchError = false;

    try {
      // Update status to processing
      await this.markJobAsProcessing(job.id);

      // All web scraping is now documentation-based

      // Fetch fresh content from the URL (all web scraping is documentation-based)
      let fetchResult;
      try {
        fetchResult = await fetchMarkdownForUrl(job.sourceUrl);

        if (!fetchResult.success) {
          isFetchError = true;
          throw new Error(`Failed to fetch content: ${fetchResult.error}`);
        }
      } catch (error) {
        isFetchError = true;
        throw error;
      }

      // Check if we got any content
      const hasContent =
        fetchResult.markdown && fetchResult.markdown.trim().length > 0;

      if (!hasContent) {
        await this.markJobAsCompleted(job.id);
        console.log(`No content found at URL ${job.sourceUrl}.`);

        // Send progress event for this skipped job
        if (job.jobId) {
          sendEvent(job.jobId, {
            type: 'progress',
            message: `Skipped (no content): ${job.sourceUrl}`,
          });
        }
        return;
      }

      console.log(
        `Processing documentation job ${job.id} for ${job.sourceUrl} with fresh content (${fetchResult.markdown!.length} chars)`,
      );

      await ragService.processJob(job, fetchResult.markdown!);
      await this.markJobAsCompleted(job.id);
      console.log(`Job ${job.id} completed successfully.`);

      // Send progress event for this completed job
      if (job.jobId) {
        sendEvent(job.jobId, {
          type: 'progress',
          message: `Completed processing: ${job.sourceUrl}`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const errorType = isFetchError ? 'fetch' : 'processing';
      await this.markJobAsFailed(job.id, message, errorType);

      // Send error event with error type
      if (job.jobId) {
        sendEvent(job.jobId, {
          type: 'progress',
          message: `Failed (${errorType}): ${job.sourceUrl} - ${message}`,
        });
      }

      throw error; // Re-throw to let the queue handle it
    }
  }

  /**
   * Start a new crawl job for a library.
   */
  async startCrawlJob(
    libraryName: string,
    libraryDescription: string,
    startUrl: string,
    customEnrichmentPrompt?: string,
  ): Promise<string> {
    const jobId = uuidv4();
    const libraryId = slug(libraryName);

    try {
      // Upsert library (now atomic with Drizzle)
      await ragService.upsertLibrary({
        id: libraryId,
        name: libraryName,
        description: libraryDescription,
      });

      const source: WebScrapeSource = {
        name: libraryName,
        description: libraryDescription,
        startUrl,
        type: 'web-scrape',
        config: {
          customEnrichmentPrompt,
        },
      };

      // Don't await, let it run in the background
      crawlSource(jobId, source, libraryId, libraryDescription);

      return jobId;
    } catch (error) {
      console.error('Error starting crawl job:', error);
      throw error;
    }
  }

  /**
   * Get the status of all embedding jobs in a crawl batch.
   *
   * @param jobId - Crawl batch ID (UUID string) from embedding_jobs.job_id
   *                Returns status for ALL URLs discovered in that crawl operation.
   * @returns Promise with summary statistics and individual job details
   *
   * Example: getCrawlJobStatus("abc-123-def-456") returns status for all URLs
   *          in that crawl batch with counts of pending/processing/completed/failed
   */
  async getCrawlJobStatus(jobId: string) {
    const rows = await db
      .select({
        id: embeddingJobs.id,
        sourceUrl: embeddingJobs.sourceUrl,
        status: embeddingJobs.status,
      })
      .from(embeddingJobs)
      .where(eq(embeddingJobs.jobId, jobId))
      .orderBy(embeddingJobs.id);

    const summary = {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      processing: rows.filter((r) => r.status === 'processing').length,
      completed: rows.filter((r) => r.status === 'completed').length,
      failed: rows.filter((r) => r.status === 'failed').length,
    };

    return {
      summary,
      jobs: rows.map((r) => ({
        id: r.id,
        sourceUrl: r.sourceUrl || '',
        status: r.status || 'pending',
      })),
    };
  }

  /**
   * Delete a single embedding job. Associated embeddings are automatically
   * deleted via CASCADE constraint on the foreign key.
   *
   * @param jobItemId - Database row ID (integer) from embedding_jobs.id
   * @returns Promise with success status
   */
  async deleteJob(jobItemId: number) {
    try {
      await db.delete(embeddingJobs).where(eq(embeddingJobs.id, jobItemId));
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete job item ${jobItemId}:`, error);
      throw error;
    }
  }

  /**
   * Process a single embedding job by database row ID.
   * Now fetches fresh content from the source URL instead of using stored content.
   *
   * @param jobItemId - Database row ID (integer) from embedding_jobs.id
   *                    NOT the crawl batch UUID! This processes ONE specific URL.
   * @returns Promise with success status and message
   *
   * Example: processSingleJob(3) processes just the URL in database row 3
   */
  async processSingleJob(jobItemId: number) {
    const rows = await db
      .select()
      .from(embeddingJobs)
      .where(eq(embeddingJobs.id, jobItemId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Job with ID ${jobItemId} not found.`);
    }

    const job = rows[0];

    try {
      // Update status to processing
      await this.markJobAsProcessing(job.id);

      // Fetch fresh content from the URL (all web scraping is documentation-based)
      const fetchResult = await fetchMarkdownForUrl(job.sourceUrl || '');

      if (!fetchResult.success) {
        throw new Error(`Failed to fetch content: ${fetchResult.error}`);
      }

      // Check if we got any content
      const hasContent =
        fetchResult.markdown && fetchResult.markdown.trim().length > 0;

      if (!hasContent) {
        await this.markJobAsCompleted(job.id);
        return {
          success: true,
          message: `No content found at URL ${job.sourceUrl}.`,
        };
      }

      // Create job payload with fresh content
      const jobPayload: EmbeddingJobPayload = {
        id: job.id, // Include the job ID
        jobId: job.jobId || undefined,
        libraryId: job.libraryId || '',
        libraryName: job.libraryName || '',
        libraryDescription: job.libraryDescription || '',
        sourceUrl: job.sourceUrl || '',
        customEnrichmentPrompt: job.customEnrichmentPrompt || undefined,
      };

      console.log(
        `Processing documentation job ${job.id} for ${job.sourceUrl} with fresh content (${fetchResult.markdown!.length} chars)`,
      );

      await ragService.processJob(jobPayload, fetchResult.markdown!);
      await this.markJobAsCompleted(job.id);

      return {
        success: true,
        message: `Job ${job.id} processed successfully with fresh content.`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markJobAsFailed(job.id, message, 'processing');
      throw error;
    }
  }

  /**
   * Start processing all embedding jobs for a given crawl batch in the background.
   *
   * @param jobId - Crawl batch ID (UUID string) from embedding_jobs.job_id
   *                This processes ALL URLs discovered in a single crawl operation.
   * @returns Promise with success status and message about worker process
   *
   * Example: processAllJobs("abc-123-def-456") processes all pending URLs
   *          from that crawl batch by running in the same process with events
   */
  async processAllJobs(jobId: string) {
    try {
      console.log(`Starting job processing for jobId: ${jobId}`);

      setImmediate(() => {
        this.processQueue(jobId).catch((error) => {
          console.error(`Error in processQueue for jobId ${jobId}:`, error);
          // Send error event if processing fails
          sendEvent(jobId, {
            type: 'progress',
            message: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          sendEvent(jobId, {
            type: 'error',
            message: 'Job processing failed',
          });
        });
      });

      return {
        success: true,
        message: `Job processing for ${jobId} started.`,
      };
    } catch (error) {
      console.error(`Failed to start job processing for ${jobId}:`, error);
      throw new Error('Failed to start job processing.');
    }
  }

  /**
   * Get the latest job ID for a library.
   */
  async getLatestJobForLibrary(libraryId: string) {
    const rows = await db
      .select({
        jobId: embeddingJobs.jobId,
      })
      .from(embeddingJobs)
      .where(eq(embeddingJobs.libraryId, libraryId))
      .orderBy(desc(embeddingJobs.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return { jobId: null };
    }

    return { jobId: rows[0].jobId };
  }

  /**
   * Get all jobs for a specific library, grouped by job batch (crawl ID).
   *
   * Returns:
   * - totalJobs: Total number of individual jobs across all batches
   * - batches: Array of job batches, each containing:
   *   - jobId: UUID of the crawl batch
   *   - createdAt: Timestamp when the batch was created
   *   - jobs: Array of individual jobs in this batch
   *   - summary: Counts of pending/processing/completed/failed jobs in this batch
   *
   * Example: getAllJobsForLibrary("react-docs") returns all crawl batches for that library
   */
  async getAllJobsForLibrary(libraryId: string): Promise<{
    totalJobs: number;
    batches: JobBatch[];
  }> {
    const rows = await db
      .select({
        id: embeddingJobs.id,
        jobId: embeddingJobs.jobId,
        sourceUrl: embeddingJobs.sourceUrl,
        status: embeddingJobs.status,
        createdAt: embeddingJobs.createdAt,
        processedAt: embeddingJobs.processedAt,
        errorMessage: embeddingJobs.errorMessage,
      })
      .from(embeddingJobs)
      .where(eq(embeddingJobs.libraryId, libraryId))
      .orderBy(desc(embeddingJobs.createdAt));

    const jobBatches: { [key: string]: JobBatch } = {};

    for (const row of rows) {
      const jobIdKey = row.jobId || '';
      if (!jobBatches[jobIdKey]) {
        jobBatches[jobIdKey] = {
          jobId: jobIdKey,
          createdAt: row.createdAt || new Date(),
          jobs: [],
        };
      }

      jobBatches[jobIdKey].jobs.push({
        id: row.id,
        sourceUrl: row.sourceUrl || '',
        status: row.status || 'pending',
        processedAt: row.processedAt,
        errorMessage: row.errorMessage,
      });
    }

    // Add summary for each batch
    Object.values(jobBatches).forEach((batch) => {
      batch.summary = {
        total: batch.jobs.length,
        pending: batch.jobs.filter((j) => j.status === 'pending').length,
        processing: batch.jobs.filter((j) => j.status === 'processing').length,
        completed: batch.jobs.filter((j) => j.status === 'completed').length,
        failed: batch.jobs.filter((j) => j.status === 'failed').length,
      };
    });

    const batches = Object.values(jobBatches);
    const totalJobs = batches.reduce(
      (sum, batch) => sum + batch.jobs.length,
      0,
    );

    return {
      totalJobs,
      batches,
    };
  }

  /**
   * Process the job queue with rate limiting and batch processing.
   *
   * @param jobId - Optional crawl batch ID (UUID string) to scope processing to.
   *                If provided, only processes jobs from that specific crawl batch.
   *                If omitted, processes jobs from all crawl batches.
   *
   * This method runs in a continuous loop, fetching and processing jobs until:
   * - No more pending jobs exist (if jobId provided, exits)
   * - Process is manually stopped (if no jobId, runs indefinitely)
   *
   * Example: processQueue("abc-123-def-456") processes only jobs from that crawl batch
   */
  async processQueue(jobId: string): Promise<void> {
    console.log('Starting embedding worker...');
    if (jobId) {
      console.log(`Processing jobs scoped to jobId: ${jobId}`);
      sendEvent(jobId, {
        type: 'progress',
        message: 'Starting job processing...',
      });
    }
    console.log(
      `Rate limit: ${this.RATE_LIMIT_PER_MINUTE}/minute, Concurrency: ${this.CONCURRENCY}`,
    );

    while (!this.shouldShutdown) {
      try {
        const jobs = await this.fetchPendingJobs(this.BATCH_SIZE, jobId);

        if (jobs.length === 0) {
          console.log('No pending jobs. Waiting for 5 seconds...');
          if (jobId) {
            console.log('Finished processing for scoped jobId. Exiting.');
            // Send completion event when all jobs are done
            sendEvent(jobId, {
              type: 'done',
              message: 'All jobs completed successfully.',
            });
            break;
          }
          // Use interruptible sleep
          await this.interruptibleSleep(5000);
          continue;
        }

        console.log(`Fetched ${jobs.length} jobs to process.`);

        // Send progress event about batch being processed
        if (jobId) {
          sendEvent(jobId, {
            type: 'progress',
            message: `Processing batch of ${jobs.length} jobs...`,
          });
        }

        // Add jobs to queue with error handling
        jobs.forEach((job) => {
          this.queue.add(async () => {
            try {
              await this.processJob(job);
            } catch (error: unknown) {
              console.error(`Error processing job ${job.id}:`, error);
              const message =
                error instanceof Error ? error.message : String(error);
              await this.markJobAsFailed(job.id, message, 'processing');

              // Send error event for this specific job
              if (job.jobId) {
                sendEvent(job.jobId, {
                  type: 'progress',
                  message: `Failed to process: ${job.sourceUrl} - ${message}`,
                });
              }
            }
          });
        });

        // Wait for current batch to complete before fetching more
        await this.queue.onIdle();

        console.log(
          `Batch processed. Queue stats: ${this.queue.size} pending, ${this.queue.pending} running`,
        );
      } catch (error) {
        console.error(
          'An unexpected error occurred in the worker loop:',
          error,
        );
        if (jobId) {
          sendEvent(jobId, {
            type: 'progress',
            message: `Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
        await this.interruptibleSleep(5000);
      }
    }

    if (this.shouldShutdown) {
      console.log('Job processing stopped due to shutdown signal.');
    }
  }
}

export const jobService = new JobService();
