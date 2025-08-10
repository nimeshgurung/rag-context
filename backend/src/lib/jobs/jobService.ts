import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import slug from 'slug';
import PQueue from 'p-queue';
import { db } from '../db';
import { embeddingJobs, libraries } from '../schema.js';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { WebScrapeSource } from '../types';
import { crawlSource } from '../crawl/crawler';
import { ragService } from '../rag/service';
import { sendEvent } from '../events';
import { fetchMarkdownForUrl } from '../crawl/utils/contentFetcher';

// For creating new jobs (without library name/description)
export interface EmbeddingJobInput {
  jobId?: string;
  libraryId: string;
  source: string; // For 'web-scrape': URL to fetch; For 'gitlab-repo': markdown content; For 'api-spec': spec content
  sourceType: string; // 'web-scrape' | 'gitlab-repo' | 'api-spec' - Required!
  originUrl?: string | null; // Canonical trace URL (e.g., gitlab://... for GitLab repos)
  additionalInstructions?: string;
  preExecutionSteps?: string;
}

// For processing jobs (with library name/description from JOIN)
export interface EmbeddingJobPayload extends EmbeddingJobInput {
  id?: number; // The database row ID for the job
  libraryName: string; // Fetched from libraries table via JOIN
  libraryDescription: string; // Fetched from libraries table via JOIN
}

export interface JobBatch {
  jobId: string;
  createdAt: Date;
  jobs: {
    id: number;
    source: string;
    sourceType: string;
    originUrl: string | null;
    status: string;
    processedAt: Date | null;
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
  async enqueueEmbeddingJobs(jobs: EmbeddingJobInput[]): Promise<void> {
    if (jobs.length === 0) {
      return;
    }

    try {
      await db.transaction(async (tx) => {
        // Prepare the data for bulk insert with proper null handling
        const jobData = jobs.map((job) => ({
          jobId: job.jobId || '',
          libraryId: job.libraryId,
          source: job.source,
          sourceType: job.sourceType,
          originUrl: job.originUrl || null,
          additionalInstructions: job.additionalInstructions || null,
          preExecutionSteps: job.preExecutionSteps || null,
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
        // Complex query with row locking requires raw SQL with JOIN to get library info
        let query = sql`
          SELECT
            ej.id,
            ej.job_id,
            ej.library_id,
            ej.source,
            ej.source_type,
            ej.origin_url,
            ej.additional_instructions,
            ej.pre_execution_steps,
            l.name as library_name,
            l.description as library_description
          FROM embedding_jobs ej
          INNER JOIN libraries l ON ej.library_id = l.id
          WHERE ej.status = 'pending'
        `;

        if (jobId) {
          query = sql`
            SELECT
              ej.id,
              ej.job_id,
              ej.library_id,
              ej.source,
              ej.source_type,
              ej.origin_url,
              ej.additional_instructions,
              ej.pre_execution_steps,
              l.name as library_name,
              l.description as library_description
            FROM embedding_jobs ej
            INNER JOIN libraries l ON ej.library_id = l.id
            WHERE ej.status = 'pending' AND ej.job_id = ${jobId}
            ORDER BY ej.created_at ASC
            LIMIT ${limit}
            FOR UPDATE OF ej SKIP LOCKED
          `;
        } else {
          query = sql`
            SELECT
              ej.id,
              ej.job_id,
              ej.library_id,
              ej.source,
              ej.source_type,
              ej.origin_url,
              ej.additional_instructions,
              ej.pre_execution_steps,
              l.name as library_name,
              l.description as library_description
            FROM embedding_jobs ej
            INNER JOIN libraries l ON ej.library_id = l.id
            WHERE ej.status = 'pending'
            ORDER BY ej.created_at ASC
            LIMIT ${limit}
            FOR UPDATE OF ej SKIP LOCKED
          `;
        }

        const result = await tx.execute(query);
        const jobs = (
          result.rows as Array<{
            id: number;
            job_id: string;
            library_id: string;
            source: string;
            source_type: string;
            origin_url: string | null;
            additional_instructions: string | null;
            pre_execution_steps: string | null;
            library_name: string;
            library_description: string;
          }>
        ).map((row) => ({
          id: row.id,
          jobId: row.job_id,
          libraryId: row.library_id,
          libraryName: row.library_name,
          libraryDescription: row.library_description,
          source: row.source,
          sourceType: row.source_type,
          originUrl: row.origin_url,
          additionalInstructions: row.additional_instructions || undefined,
          preExecutionSteps: row.pre_execution_steps || undefined,
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
   * Mark a job as failed.
   * @param jobId - The job ID to mark as failed
   */
  private async markJobAsFailed(jobId: number) {
    await db
      .update(embeddingJobs)
      .set({
        status: 'failed',
        updatedAt: new Date(),
        processedAt: new Date(),
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

      // Handle different source types - aligned with DocumentationSource types
      let markdown: string | undefined;
      let displayUrl: string;
      let embeddingSourceUrl: string;

      switch (job.sourceType) {
        case 'gitlab-repo':
          // GitLab repos have pre-fetched markdown content in the source field
          markdown = job.source;
          // Use originUrl for display and embedding tracking
          displayUrl = job.originUrl || 'gitlab-repo';
          embeddingSourceUrl = job.originUrl || 'gitlab-repo';

          console.log(
            `Processing GitLab job ${job.id} from stored content (${markdown.length} chars), origin: ${displayUrl}`,
          );
          break;

        case 'web-scrape':
          // Web scrapes need to fetch content from the URL in the source field
          let fetchResult;
          try {
            fetchResult = await fetchMarkdownForUrl(
              job.source,
              job.preExecutionSteps,
            );

            if (!fetchResult.success) {
              isFetchError = true;
              throw new Error(`Failed to fetch content: ${fetchResult.error}`);
            }

            markdown = fetchResult.markdown;
            displayUrl = job.source;
            embeddingSourceUrl = job.source;
          } catch (error) {
            isFetchError = true;
            throw error;
          }

          console.log(
            `Processing web-scrape job ${job.id} for ${job.source} with fresh content (${markdown?.length || 0} chars)`,
          );
          break;

        case 'api-spec':
          // API specs shouldn't normally go through this flow, but handle them if they do
          markdown = job.source;
          displayUrl = job.originUrl || 'api-spec';
          embeddingSourceUrl = job.originUrl || 'api-spec';

          console.log(
            `Processing API spec job ${job.id} - unexpected in this flow`,
          );
          break;

        default:
          // This should never happen with proper sourceType validation
          throw new Error(
            `Invalid sourceType: ${job.sourceType}. Must be 'web-scrape', 'gitlab-repo', or 'api-spec'`,
          );
      }

      // Check if we got any content
      const hasContent = markdown && markdown.trim().length > 0;

      if (!hasContent) {
        await this.markJobAsCompleted(job.id);
        console.log(`No content found for job ${job.id}.`);

        // Send progress event for this skipped job
        if (job.jobId) {
          sendEvent(job.jobId, {
            type: 'progress',
            message: `Skipped (no content): ${displayUrl}`,
          });
        }
        return;
      }

      // Process the job with the correct source URL for embedding tracking
      await ragService.processJob(
        { ...job, source: embeddingSourceUrl },
        markdown!,
      );
      await this.markJobAsCompleted(job.id);
      console.log(`Job ${job.id} completed successfully.`);

      // Send progress event for this completed job
      if (job.jobId) {
        sendEvent(job.jobId, {
          type: 'progress',
          message: `Completed processing: ${displayUrl}`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const errorType = isFetchError ? 'fetch' : 'processing';
      await this.markJobAsFailed(job.id);

      // Send error event with error type
      if (job.jobId) {
        sendEvent(job.jobId, {
          type: 'progress',
          message: `Failed (${errorType}): ${job.originUrl || job.source} - ${message}`,
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
    additionalInstructions?: string,
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
          additionalInstructions,
        },
      };

      // Don't await, let it run in the background
      crawlSource(jobId, source, libraryId, libraryName, libraryDescription);

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
        source: embeddingJobs.source,
        sourceType: embeddingJobs.sourceType,
        originUrl: embeddingJobs.originUrl,
        status: embeddingJobs.status,
        processedAt: embeddingJobs.processedAt,
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
        source: r.source || '',
        sourceType: r.sourceType || 'web-scrape',
        originUrl: r.originUrl,
        status: r.status || 'pending',
        processedAt: r.processedAt,
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
      .select({
        id: embeddingJobs.id,
        jobId: embeddingJobs.jobId,
        libraryId: embeddingJobs.libraryId,
        source: embeddingJobs.source,
        sourceType: embeddingJobs.sourceType,
        originUrl: embeddingJobs.originUrl,
        additionalInstructions: embeddingJobs.additionalInstructions,
        preExecutionSteps: embeddingJobs.preExecutionSteps,
        libraryName: libraries.name,
        libraryDescription: libraries.description,
      })
      .from(embeddingJobs)
      .innerJoin(libraries, eq(embeddingJobs.libraryId, libraries.id))
      .where(eq(embeddingJobs.id, jobItemId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Job with ID ${jobItemId} not found.`);
    }

    try {
      // Update status to processing
      await this.markJobAsProcessing(rows[0].id);

      let markdown: string | undefined;
      let sourceUrl: string;

      // Branch logic based on sourceType - aligned with DocumentationSource types
      switch (rows[0].sourceType) {
        case 'gitlab-repo':
          // GitLab repos have pre-fetched markdown content in the source field
          console.log(
            `Processing GitLab job ${rows[0].id} with pre-fetched content from ${rows[0].originUrl}`,
          );
          markdown = rows[0].source;
          sourceUrl = rows[0].originUrl || 'gitlab-repo';
          break;

        case 'web-scrape':
          // Web scrapes need to fetch content from the URL in the source field
          console.log(
            `Fetching content for web-scrape job ${rows[0].id} from ${rows[0].source}`,
          );

          const fetchResult = await fetchMarkdownForUrl(
            rows[0].source,
            rows[0].preExecutionSteps || undefined,
          );

          if (!fetchResult.success) {
            throw new Error(`Failed to fetch content: ${fetchResult.error}`);
          }

          markdown = fetchResult.markdown;
          sourceUrl = rows[0].source;
          break;

        case 'api-spec':
          // API specs are processed differently and shouldn't normally go through this flow
          // but if they do, treat the source as content
          console.log(
            `Processing API spec job ${rows[0].id} - this is unexpected, API specs should be processed directly`,
          );
          markdown = rows[0].source;
          sourceUrl = rows[0].originUrl || 'api-spec';
          break;

        default:
          // This should never happen with proper sourceType validation
          throw new Error(
            `Invalid sourceType: ${rows[0].sourceType}. Must be 'web-scrape', 'gitlab-repo', or 'api-spec'`,
          );
      }

      // Check if we got any content
      const hasContent = markdown && markdown.trim().length > 0;

      if (!hasContent) {
        await this.markJobAsCompleted(rows[0].id);
        return {
          success: true,
          message: `No content found for job ${rows[0].id}.`,
        };
      }

      // Create job payload
      const jobPayload: EmbeddingJobPayload = {
        id: rows[0].id,
        jobId: rows[0].jobId || undefined,
        libraryId: rows[0].libraryId,
        libraryName: rows[0].libraryName,
        libraryDescription: rows[0].libraryDescription,
        source: sourceUrl, // Use the appropriate source URL for tracking
        sourceType: rows[0].sourceType,
        originUrl: rows[0].originUrl || undefined,
        additionalInstructions: rows[0].additionalInstructions || undefined,
        preExecutionSteps: rows[0].preExecutionSteps || undefined,
      };

      console.log(
        `Processing job ${rows[0].id} for ${sourceUrl} with content (${markdown!.length} chars)`,
      );

      await ragService.processJob(jobPayload, markdown!);
      await this.markJobAsCompleted(rows[0].id);

      return {
        success: true,
        message: `Job ${rows[0].id} processed successfully.`,
      };
    } catch (error: unknown) {
      await this.markJobAsFailed(rows[0].id);
      throw error;
    }
  }

  /**
   * Requeue a single job item and start/trigger the child-process batch for its batch jobId
   */
  async requeueAndStartSingle(jobItemId: number) {
    // Find the job and its batch id
    const rows = await db
      .select({ id: embeddingJobs.id, jobId: embeddingJobs.jobId })
      .from(embeddingJobs)
      .where(eq(embeddingJobs.id, jobItemId))
      .limit(1);

    if (rows.length === 0 || !rows[0].jobId) {
      throw new Error(`Job ${jobItemId} not found or missing jobId`);
    }

    const jobId = rows[0].jobId as string;

    // Requeue the item: set back to pending
    await db
      .update(embeddingJobs)
      .set({ status: 'pending', processedAt: null })
      .where(eq(embeddingJobs.id, jobItemId));

    // Start/trigger the child-process batch for this jobId
    return await this.processAllJobs(jobId);
  }

  /**
   * Requeue multiple selected job items for a batch and start/trigger the child worker
   */
  async requeueAndStartSelected(jobId: string, jobItemIds: number[]) {
    if (!jobItemIds?.length) {
      return {
        success: false,
        message: 'No job ids provided',
        statusCode: 400,
      };
    }

    // Validate all ids belong to the same jobId
    const owners = await db
      .select({ id: embeddingJobs.id, jobId: embeddingJobs.jobId })
      .from(embeddingJobs)
      .where(inArray(embeddingJobs.id, jobItemIds));

    if (owners.length !== jobItemIds.length) {
      return {
        success: false,
        message: 'One or more ids not found',
        statusCode: 400,
      };
    }

    const distinctJobIds = new Set(owners.map((o) => o.jobId));
    if (distinctJobIds.size !== 1 || !distinctJobIds.has(jobId)) {
      return {
        success: false,
        message: 'IDs belong to different jobId',
        statusCode: 400,
      };
    }

    // Requeue all
    await db
      .update(embeddingJobs)
      .set({ status: 'pending', processedAt: null })
      .where(inArray(embeddingJobs.id, jobItemIds));

    // Trigger child-process batch
    return await this.processAllJobs(jobId);
  }

  /**
   * Start processing all embedding jobs for a given crawl batch using child process.
   *
   * @param jobId - Crawl batch ID (UUID string) from embedding_jobs.job_id
   *                This processes ALL URLs discovered in a single crawl operation.
   * @returns Promise with success status and message, or error status codes
   *
   * Example: processAllJobs("abc-123-def-456") processes all pending URLs
   *          from that crawl batch by spawning a child process
   */
  async processAllJobs(jobId: string) {
    // Import childProcessManager here to avoid circular dependency
    const { childProcessManager } = await import('./childProcessManager');

    // Check capacity
    const capacityCheck = childProcessManager.canStartBatch(jobId);
    if (!capacityCheck.canStart) {
      const statusCode =
        capacityCheck.reason === 'Batch already running' ? 202 : 429;
      return {
        success: false,
        message: capacityCheck.reason!,
        statusCode,
      };
    }

    // Start batch processing in child process
    const result = await childProcessManager.startBatch(jobId);

    if (result.success) {
      return {
        success: true,
        message: result.message,
        statusCode: 200,
      };
    } else {
      return {
        success: false,
        message: result.message,
        statusCode: 500,
      };
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
        source: embeddingJobs.source,
        sourceType: embeddingJobs.sourceType,
        originUrl: embeddingJobs.originUrl,
        status: embeddingJobs.status,
        createdAt: embeddingJobs.createdAt,
        processedAt: embeddingJobs.processedAt,
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
        source: row.source || '',
        sourceType: row.sourceType || 'web-scrape',
        originUrl: row.originUrl,
        status: row.status || 'pending',
        processedAt: row.processedAt,
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
              await this.markJobAsFailed(job.id);

              // Send error event for this specific job
              if (job.jobId) {
                sendEvent(job.jobId, {
                  type: 'progress',
                  message: `Failed to process: ${job.originUrl || job.source} - ${message}`,
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
