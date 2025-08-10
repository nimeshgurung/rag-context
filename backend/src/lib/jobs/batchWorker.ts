#!/usr/bin/env node
import 'dotenv/config';
import PQueue from 'p-queue';
import { fileURLToPath } from 'url';
import { db } from '../db';
import { embeddingJobs } from '../schema';
import { eq, sql } from 'drizzle-orm';
import { ragService } from '../rag/service';
import { fetchMarkdownForUrl } from '../crawl/utils/contentFetcher';

// IPC Message interface
interface IPCMessage {
  type: 'started' | 'progress' | 'job-progress' | 'done' | 'error' | 'shutdown';
  jobId: string;
  message?: string;
  itemId?: number;
  status?: 'completed' | 'failed';
  source?: string;
  error?: string;
}

// Job payload interface
interface EmbeddingJobPayload {
  id: number;
  jobId?: string;
  libraryId: string;
  libraryName: string;
  libraryDescription: string;
  source: string;
  sourceType: string;
  originUrl?: string | null;
  additionalInstructions?: string;
  preExecutionSteps?: string;
}

/**
 * Batch Worker - Runs in child process to handle embedding job processing
 */
class BatchWorker {
  private readonly jobId: string;
  private readonly queue: PQueue;
  private readonly CONCURRENCY: number;
  private readonly BATCH_SIZE: number;
  private readonly RATE_LIMIT_PER_MINUTE: number;
  private shouldShutdown = false;

  constructor(jobId: string) {
    this.jobId = jobId;

    // Read environment configuration
    this.CONCURRENCY = process.env.EMBEDDING_CONCURRENCY
      ? parseInt(process.env.EMBEDDING_CONCURRENCY, 10)
      : 2;
    this.BATCH_SIZE = process.env.EMBEDDING_BATCH_SIZE
      ? parseInt(process.env.EMBEDDING_BATCH_SIZE, 10)
      : 5;
    this.RATE_LIMIT_PER_MINUTE = process.env.EMBEDDING_RATE_LIMIT
      ? parseInt(process.env.EMBEDDING_RATE_LIMIT, 10)
      : 20;

    // Initialize PQueue with rate limiting
    this.queue = new PQueue({
      concurrency: this.CONCURRENCY,
      interval: 60 * 1000, // 1 minute
      intervalCap: this.RATE_LIMIT_PER_MINUTE,
    });

    console.log(`BatchWorker initialized for jobId: ${jobId}`);
    console.log(
      `Configuration: concurrency=${this.CONCURRENCY}, batchSize=${this.BATCH_SIZE}, rateLimit=${this.RATE_LIMIT_PER_MINUTE}/min`,
    );
  }

  /**
   * Send IPC message to parent process
   */
  private sendIPC(message: Omit<IPCMessage, 'jobId'>): void {
    if (process.send) {
      try {
        process.send({ ...message, jobId: this.jobId });
      } catch (error) {
        console.error('Failed to send IPC message:', error);
      }
    }
  }

  /**
   * Fetch pending jobs for this batch
   */
  private async fetchPendingJobs(
    limit: number,
  ): Promise<EmbeddingJobPayload[]> {
    try {
      return await db.transaction(async (tx) => {
        const query = sql`
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
          WHERE ej.status = 'pending' AND ej.job_id = ${this.jobId}
          ORDER BY ej.created_at ASC
          LIMIT ${limit}
          FOR UPDATE OF ej SKIP LOCKED
        `;

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

        return jobs;
      });
    } catch (error) {
      console.error('Error fetching pending jobs:', error);
      throw error;
    }
  }

  /**
   * Mark a job as completed
   */
  private async markJobAsCompleted(jobId: number): Promise<void> {
    await db
      .update(embeddingJobs)
      .set({ status: 'completed' })
      .where(eq(embeddingJobs.id, jobId));
  }

  /**
   * Mark a job as failed
   */
  private async markJobAsFailed(jobId: number): Promise<void> {
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
   * Process a single job
   */
  private async processJob(job: EmbeddingJobPayload): Promise<void> {
    let isFetchError = false;

    try {
      // Transition to processing just-in-time to avoid stranded rows
      await db
        .update(embeddingJobs)
        .set({ status: 'processing', processedAt: new Date() })
        .where(eq(embeddingJobs.id, job.id));

      // Handle different source types
      let markdown: string | undefined;
      let displayUrl: string;
      let embeddingSourceUrl: string;

      switch (job.sourceType) {
        case 'gitlab-repo':
          markdown = job.source;
          displayUrl = job.originUrl || 'gitlab-repo';
          embeddingSourceUrl = job.originUrl || 'gitlab-repo';
          console.log(
            `Processing GitLab job ${job.id} from stored content (${markdown.length} chars), origin: ${displayUrl}`,
          );
          break;

        case 'web-scrape':
          try {
            const fetchResult = await fetchMarkdownForUrl(
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
          markdown = job.source;
          displayUrl = job.originUrl || 'api-spec';
          embeddingSourceUrl = job.originUrl || 'api-spec';
          console.log(
            `Processing API spec job ${job.id} - unexpected in this flow`,
          );
          break;

        default:
          throw new Error(
            `Invalid sourceType: ${job.sourceType}. Must be 'web-scrape', 'gitlab-repo', or 'api-spec'`,
          );
      }

      // Check if we got any content
      const hasContent = markdown && markdown.trim().length > 0;

      if (!hasContent) {
        await this.markJobAsCompleted(job.id);
        console.log(`No content found for job ${job.id}.`);

        this.sendIPC({
          type: 'job-progress',
          itemId: job.id,
          status: 'completed',
          source: displayUrl,
          message: 'Skipped (no content)',
        });
        return;
      }

      // Process the job with the correct source URL for embedding tracking
      await ragService.processJob(
        { ...job, source: embeddingSourceUrl },
        markdown!,
      );
      await this.markJobAsCompleted(job.id);
      console.log(`Job ${job.id} completed successfully.`);

      this.sendIPC({
        type: 'job-progress',
        itemId: job.id,
        status: 'completed',
        source: displayUrl,
        message: 'Completed processing',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const errorType = isFetchError ? 'fetch' : 'processing';
      await this.markJobAsFailed(job.id);

      console.error(`Job ${job.id} failed (${errorType}):`, message);

      this.sendIPC({
        type: 'job-progress',
        itemId: job.id,
        status: 'failed',
        source: job.originUrl || job.source,
        error: message,
        message: `Failed (${errorType}): ${message}`,
      });

      throw error; // Re-throw to let the queue handle it
    }
  }

  /**
   * Main processing loop
   */
  async run(): Promise<void> {
    console.log(`Starting batch processing for jobId: ${this.jobId}`);

    // Send started message
    this.sendIPC({ type: 'started' });

    try {
      // Recover any stranded rows from prior crash for this batch
      try {
        await db
          .update(embeddingJobs)
          .set({ status: 'pending' })
          .where(
            sql`${embeddingJobs.jobId} = ${this.jobId} AND ${embeddingJobs.status} = 'processing'`,
          );
      } catch (recoveryError) {
        console.error(
          'Failed to reset stranded processing jobs:',
          recoveryError,
        );
      }

      while (!this.shouldShutdown) {
        const jobs = await this.fetchPendingJobs(this.BATCH_SIZE);

        if (jobs.length === 0) {
          console.log('No pending jobs found. Processing complete.');
          this.sendIPC({
            type: 'done',
            message: 'All jobs completed successfully',
          });
          break;
        }

        console.log(`Fetched ${jobs.length} jobs to process.`);

        // Send progress message
        this.sendIPC({
          type: 'progress',
          message: `Processing batch of ${jobs.length} jobs...`,
        });

        // Add jobs to queue with error handling
        jobs.forEach((job) => {
          this.queue.add(async () => {
            try {
              await this.processJob(job);
            } catch (error: unknown) {
              console.error(`Error processing job ${job.id}:`, error);
              // Error already handled in processJob, just continue
            }
          });
        });

        // Wait for current batch to complete before fetching more
        await this.queue.onIdle();

        console.log(
          `Batch processed. Queue stats: ${this.queue.size} pending, ${this.queue.pending} running`,
        );
      }

      if (this.shouldShutdown) {
        console.log('Job processing stopped due to shutdown signal.');

        // Wait for any in-flight jobs to complete
        await this.queue.onIdle();

        this.sendIPC({
          type: 'done',
          message: 'Processing stopped due to shutdown',
        });
      }
    } catch (error) {
      console.error('Batch processing failed:', error);
      this.sendIPC({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }

    console.log(`Batch processing completed for jobId: ${this.jobId}`);
    process.exit(0);
  }

  /**
   * Handle shutdown signal
   */
  shutdown(): void {
    console.log('Received shutdown signal');
    this.shouldShutdown = true;
    this.queue.clear(); // Clear pending jobs
  }
}

// Main execution
async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Please provide a jobId as the first argument.');
    process.exit(1);
  }

  const worker = new BatchWorker(jobId);

  // Handle shutdown messages from parent
  process.on('message', (message: IPCMessage) => {
    if (message && message.type === 'shutdown') {
      worker.shutdown();
    }
  });

  // Handle process signals
  process.on('SIGINT', () => worker.shutdown());
  process.on('SIGTERM', () => worker.shutdown());

  try {
    await worker.run();
  } catch (error) {
    console.error(`Worker process failed for jobId: ${jobId}`, error);
    process.exit(1);
  }
}

// Run if this file is executed directly (ESM-safe)
try {
  const thisFile = fileURLToPath(import.meta.url);
  if (process.argv[1] && thisFile === process.argv[1]) {
    // Executed as the entrypoint (forked)
    main();
  }
} catch {
  // Fallback: execute main in environments where the above check fails
  main();
}
