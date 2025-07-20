import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import slug from 'slug';
import { spawn } from 'child_process';
import PQueue from 'p-queue';
import { db } from '../db';
import { embeddingJobs, embeddings } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import pool from '../db'; // Keep for backward compatibility during migration
import { WebScrapeSource } from '../types';
import { crawlSource } from '../crawl/crawler';
import { ragService } from '../rag/service';

export interface EmbeddingJobPayload {
  jobId?: string;
  libraryId: string;
  libraryName: string;
  libraryDescription: string;
  sourceUrl: string;
  rawSnippets: string[];
  contextMarkdown?: string;
  scrapeType: 'code' | 'documentation';
  customEnrichmentPrompt?: string;
}

interface JobStatusRow {
  id: number;
  source_url: string;
  status: string;
}

interface JobBatch {
  jobId: string;
  createdAt: Date;
  jobs: {
    id: number;
    sourceUrl: string;
    status: string;
    processedAt: Date | null;
    errorMessage: string | null;
    scrapeType: string;
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

  /**
   * Enqueue multiple embedding jobs into the database.
   */
  async enqueueEmbeddingJobs(jobs: EmbeddingJobPayload[]): Promise<void> {
    if (jobs.length === 0) {
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO embedding_jobs (job_id, library_id, library_name, library_description, source_url, raw_snippets, context_markdown, scrape_type, custom_enrichment_prompt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      for (const job of jobs) {
        const values = [
          job.jobId,
          job.libraryId,
          job.libraryName,
          job.libraryDescription,
          job.sourceUrl,
          JSON.stringify(job.rawSnippets),
          job.contextMarkdown,
          job.scrapeType,
          job.customEnrichmentPrompt,
        ];
        await client.query(query, values);
      }

      await client.query('COMMIT');
      console.log(`Enqueued ${jobs.length} embedding jobs.`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error enqueuing embedding jobs:', error);
      throw error;
    } finally {
      client.release();
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const params: (string | number)[] = [];
      let query = `
        SELECT *
        FROM embedding_jobs
        WHERE status = 'pending'
      `;

      if (jobId) {
        params.push(jobId);
        query += ` AND job_id = $${params.length}`;
      }

      params.push(limit);
      query += ` ORDER BY created_at ASC LIMIT $${params.length} FOR UPDATE SKIP LOCKED`;

      const res = await client.query(query, params);
      const jobs = res.rows.map((row) => ({
        id: row.id,
        jobId: row.job_id,
        libraryId: row.library_id,
        libraryName: row.library_name,
        libraryDescription: row.library_description,
        sourceUrl: row.source_url,
        rawSnippets: row.raw_snippets,
        contextMarkdown: row.context_markdown,
        scrapeType: row.scrape_type,
        customEnrichmentPrompt: row.custom_enrichment_prompt,
      }));

      if (jobs.length > 0) {
        const jobIds = jobs.map((j) => j.id);
        await client.query(
          `UPDATE embedding_jobs SET status = 'processing', processed_at = NOW() WHERE id = ANY($1::int[])`,
          [jobIds],
        );
      }

      await client.query('COMMIT');
      return jobs;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error fetching pending jobs:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark a job as completed.
   */
  private async markJobAsCompleted(jobId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE embedding_jobs SET status = 'completed' WHERE id = $1`,
        [jobId],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Mark a job as failed with error message.
   */
  private async markJobAsFailed(
    jobId: number,
    errorMessage: string,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE embedding_jobs SET status = 'failed', error_message = $1 WHERE id = $2`,
        [errorMessage, jobId],
      );
    } finally {
      client.release();
    }
  }

  /**
   * Process a single job by calling the appropriate RAG service method.
   */
  private async processJob(
    job: EmbeddingJobPayload & { id: number },
  ): Promise<void> {
    await ragService.processJob(job);
    await this.markJobAsCompleted(job.id);
    console.log(`Job ${job.id} completed successfully.`);
  }

  /**
   * Start a new crawl job for a library.
   */
  async startCrawlJob(
    libraryName: string,
    libraryDescription: string,
    startUrl: string,
    scrapeType: 'code' | 'documentation',
    customEnrichmentPrompt?: string,
  ): Promise<string> {
    const jobId = uuidv4();
    const libraryId = slug(libraryName);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await ragService.upsertLibrary({
        id: libraryId,
        name: libraryName,
        description: libraryDescription,
      });

      await client.query('COMMIT');

      const source: WebScrapeSource = {
        name: libraryName,
        description: libraryDescription,
        startUrl,
        type: 'web-scrape',
        config: {
          scrapeType,
          customEnrichmentPrompt,
        },
      };

      // Don't await, let it run in the background
      crawlSource(jobId, source, libraryId, libraryDescription);

      return jobId;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error starting crawl job:', error);
      throw error;
    } finally {
      client.release();
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
      pending: rows.filter(r => r.status === 'pending').length,
      processing: rows.filter(r => r.status === 'processing').length,
      completed: rows.filter(r => r.status === 'completed').length,
      failed: rows.filter(r => r.status === 'failed').length,
    };

    return {
      summary,
      jobs: rows.map(r => ({
        id: r.id,
        sourceUrl: r.sourceUrl || '',
        status: r.status || 'pending',
      })),
    };
  }

  /**
   * Delete a single embedding job and its associated embeddings by database row ID.
   *
   * @param jobItemId - Database row ID (integer) from embedding_jobs.id
   *                    NOT the crawl batch UUID! This deletes ONE specific URL.
   * @returns Promise with success status
   *
   * Example: deleteJob(3) deletes just the URL in database row 3 and its embeddings
   */
  async deleteJob(jobItemId: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const jobResult = await client.query(
        'SELECT source_url, library_id FROM embedding_jobs WHERE id = $1',
        [jobItemId],
      );

      if (jobResult.rows.length === 0) {
        throw new Error(`Job item with ID ${jobItemId} not found.`);
      }

      const { source_url: sourceUrl, library_id: libraryId } =
        jobResult.rows[0];

      // Delete associated embeddings
      await client.query(
        "DELETE FROM embeddings WHERE library_id = $1 AND metadata->>'source' = $2",
        [libraryId, sourceUrl],
      );

      // Delete the job
      await client.query('DELETE FROM embedding_jobs WHERE id = $1', [
        jobItemId,
      ]);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Failed to delete job item ${jobItemId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process a single embedding job by its database row ID.
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
      // Check if job has content to process based on job type
      const hasContent =
        job.scrapeType === 'documentation'
          ? job.contextMarkdown && job.contextMarkdown.trim().length > 0
          : job.rawSnippets && Array.isArray(job.rawSnippets) && job.rawSnippets.length > 0;

      if (!hasContent) {
        await this.markJobAsCompleted(job.id);
        const contentType =
          job.scrapeType === 'documentation' ? 'markdown' : 'snippets';
        return {
          success: true,
          message: `Job has no ${contentType} to process.`,
        };
      }

      const jobPayload: EmbeddingJobPayload = {
        jobId: job.jobId || '',
        libraryId: job.libraryId || '',
        libraryName: job.libraryName || '',
        libraryDescription: job.libraryDescription || '',
        sourceUrl: job.sourceUrl || '',
        rawSnippets: Array.isArray(job.rawSnippets) ? job.rawSnippets : [],
        contextMarkdown: job.contextMarkdown || undefined,
        scrapeType: (job.scrapeType as 'code' | 'documentation') || 'documentation',
        customEnrichmentPrompt: job.customEnrichmentPrompt || undefined,
      };

      console.log(
        `Processing ${job.scrapeType} job ${job.id} for ${job.sourceUrl}`,
      );
      await ragService.processJob(jobPayload);
      await this.markJobAsCompleted(job.id);

      return {
        success: true,
        message: `Job ${job.id} processed successfully.`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markJobAsFailed(job.id, message);
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
   *          from that crawl batch by spawning a background worker process
   */
  async processAllJobs(jobId: string) {
    try {
      const workerCommand = 'npm';
      const workerArgs = ['run', 'process-all', '--', jobId];

      console.log(
        `Spawning worker for jobId: ${jobId} with command: ${workerCommand} ${workerArgs.join(' ')}`,
      );

      const child = spawn(workerCommand, workerArgs, {
        detached: true,
        stdio: 'inherit',
      });

      child.on('error', (err) => {
        console.error(
          `Failed to start worker process for jobId ${jobId}:`,
          err,
        );
      });

      child.unref();

      return {
        success: true,
        message: `Embedding worker process for ${jobId} started in the background.`,
      };
    } catch (error) {
      console.error(
        `Failed to start embedding worker process for ${jobId}:`,
        error,
      );
      throw new Error('Failed to start embedding worker process.');
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
    const { rows } = await pool.query(
      `SELECT id, job_id, source_url, status, created_at, processed_at, error_message, scrape_type
       FROM embedding_jobs
       WHERE library_id = $1
       ORDER BY created_at DESC`,
      [libraryId],
    );

    const jobBatches: { [key: string]: JobBatch } = {};

    for (const row of rows) {
      if (!jobBatches[row.job_id]) {
        jobBatches[row.job_id] = {
          jobId: row.job_id,
          createdAt: row.created_at,
          jobs: [],
        };
      }

      jobBatches[row.job_id].jobs.push({
        id: row.id,
        sourceUrl: row.source_url,
        status: row.status,
        processedAt: row.processed_at,
        errorMessage: row.error_message,
        scrapeType: row.scrape_type,
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
  async processQueue(jobId?: string): Promise<void> {
    console.log('Starting embedding worker...');
    if (jobId) {
      console.log(`Processing jobs scoped to jobId: ${jobId}`);
    }
    console.log(
      `Rate limit: ${this.RATE_LIMIT_PER_MINUTE}/minute, Concurrency: ${this.CONCURRENCY}`,
    );

    while (true) {
      try {
        const jobs = await this.fetchPendingJobs(this.BATCH_SIZE, jobId);

        if (jobs.length === 0) {
          console.log('No pending jobs. Waiting for 5 seconds...');
          if (jobId) {
            console.log('Finished processing for scoped jobId. Exiting.');
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        console.log(`Fetched ${jobs.length} jobs to process.`);

        // Add jobs to queue with error handling
        jobs.forEach((job) => {
          this.queue.add(async () => {
            try {
              await this.processJob(job);
            } catch (error: unknown) {
              console.error(`Error processing job ${job.id}:`, error);
              const message =
                error instanceof Error ? error.message : String(error);
              await this.markJobAsFailed(job.id, message);
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
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
}

export const jobService = new JobService();
