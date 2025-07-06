import 'dotenv/config';
import {
  fetchPendingJobs,
  markJobAsCompleted,
  markJobAsFailed,
  saveEnrichedData,
} from '../jobs/storage';
import { getEnrichedDataFromLLM } from './enrichment';
import pool from '../db';
import { EnrichedItem } from '../types';

const RATE_LIMIT_PER_MINUTE = process.env.EMBEDDING_RATE_LIMIT
  ? parseInt(process.env.EMBEDDING_RATE_LIMIT, 10)
  : 50; // Requests per minute
const BATCH_SIZE = 10; // Number of jobs to fetch at once
const PAUSE_BETWEEN_BATCHES = (60 / RATE_LIMIT_PER_MINUTE) * BATCH_SIZE * 1000; // time in ms to wait

async function processQueue() {
  console.log('Starting embedding worker...');
  console.log(
    `Rate limit: ${RATE_LIMIT_PER_MINUTE}/minute, Batch size: ${BATCH_SIZE}`,
  );
  console.log(`Pausing for ${PAUSE_BETWEEN_BATCHES}ms between batches.`);

  while (true) {
    try {
      const jobs = await fetchPendingJobs(BATCH_SIZE);
      if (jobs.length === 0) {
        console.log('No pending jobs. Waiting for 5 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      console.log(`Fetched ${jobs.length} jobs to process.`);

      const processingPromises = jobs.map(async (job) => {
        try {
          // A job now contains multiple snippets
          if (!job.rawSnippets || job.rawSnippets.length === 0) {
            console.log(`Job ${job.id} has no snippets, marking as complete.`);
            await markJobAsCompleted(job.id);
            return;
          }

          const enrichedItems: EnrichedItem[] = [];
          for (const snippet of job.rawSnippets) {
            const enrichedData = await getEnrichedDataFromLLM(
              snippet,
              job.contextMarkdown,
            );
            if (enrichedData) {
              enrichedItems.push(enrichedData);
            }
          }

          if (enrichedItems.length > 0) {
            await saveEnrichedData(
              enrichedItems,
              {
                libraryId: job.libraryId,
                libraryName: job.libraryName,
                libraryDescription: job.libraryDescription,
              },
              job.sourceUrl,
            );
          }

          await markJobAsCompleted(job.id);
          console.log(
            `Job ${job.id} completed successfully with ${enrichedItems.length} snippets.`,
          );
        } catch (error: unknown) {
          console.error(`Error processing job ${job.id}:`, error);
          const message =
            error instanceof Error ? error.message : String(error);
          await markJobAsFailed(job.id, message);
        }
      });

      await Promise.all(processingPromises);

      console.log('Batch processed. Pausing...');
      await new Promise((resolve) =>
        setTimeout(resolve, PAUSE_BETWEEN_BATCHES),
      );
    } catch (error) {
      console.error('An unexpected error occurred in the worker loop:', error);
      // Wait for a bit before retrying to avoid fast failure loops
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

processQueue().catch(async (e) => {
  console.error('Worker process failed:', e);
  await pool.end();
  process.exit(1);
});
