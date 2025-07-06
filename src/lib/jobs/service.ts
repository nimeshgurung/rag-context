import { v4 as uuidv4 } from 'uuid';
import slug from 'slug';
import { embed } from 'ai';
import pool from '../db';
import { WebScrapeSource } from '../types';
import { crawlSingleSource } from '../crawl/crawler';
import { exec } from 'child_process';
import util from 'util';
import { openai } from '../ai/service';
import { getEnrichedDataFromLLM } from '../embedding/enrichment';
import { markJobAsCompleted, markJobAsFailed } from './storage';
import { saveEnrichedData } from '../embedding/saveEnrichedData';

const execAsync = util.promisify(exec);

export async function startCrawlJob(
  libraryName: string,
  libraryDescription: string,
  startUrl: string,
) {
  const jobId = uuidv4();
  const libraryId = slug(libraryName);

  // Use a transaction to ensure the library is created before the crawl starts
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: `${libraryName}: ${libraryDescription}`,
    });

    const libraryInsertQuery = `
      INSERT INTO libraries (id, name, description, embedding)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        embedding = EXCLUDED.embedding;
    `;
    await client.query(libraryInsertQuery, [
      libraryId,
      libraryName,
      libraryDescription,
      `[${embedding.join(',')}]`,
    ]);

    await client.query('COMMIT');

    const source: WebScrapeSource = {
      name: libraryName,
      description: libraryDescription,
      startUrl,
      type: 'web-scrape',
      config: {},
    };

    // Don't await, let it run in the background
    crawlSingleSource(jobId, source, libraryId, libraryDescription);

    return jobId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting crawl job:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getCrawlJobStatus(jobId: string) {
  const { rows } = await pool.query(
    'SELECT id, source_url, status FROM embedding_jobs WHERE job_id = $1 ORDER BY id',
    [jobId],
  );

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
      sourceUrl: r.source_url,
      status: r.status,
    })),
  };
}

export async function reprocessJob(jobItemId: number) {
  await pool.query(
    `UPDATE embedding_jobs SET status = 'pending', processed_at = null, error_message = null WHERE id = $1`,
    [jobItemId],
  );
  return { success: true };
}

export async function deleteJob(jobItemId: number) {
  await pool.query('DELETE FROM embedding_jobs WHERE id = $1', [jobItemId]);
  return { success: true };
}

export async function processSingleJob(jobItemId: number) {
  const { rows } = await pool.query(
    'SELECT * FROM embedding_jobs WHERE id = $1',
    [jobItemId],
  );

  if (rows.length === 0) {
    throw new Error(`Job with ID ${jobItemId} not found.`);
  }

  const job = rows[0];

  try {
    if (!job.raw_snippets || job.raw_snippets.length === 0) {
      await markJobAsCompleted(job.id);
      return { success: true, message: 'Job has no snippets.' };
    }

    const enrichedItems = [];
    for (const snippet of job.raw_snippets) {
      const enrichedData = await getEnrichedDataFromLLM(
        snippet,
        job.context_markdown,
      );
      if (enrichedData) {
        enrichedItems.push(enrichedData);
      }
    }

    if (enrichedItems.length > 0) {
      await saveEnrichedData(
        enrichedItems,
        {
          libraryId: job.library_id,
          libraryName: job.library_name,
          libraryDescription: job.library_description,
        },
        job.source_url,
      );
    }

    await markJobAsCompleted(job.id);
    return {
      success: true,
      message: `Job ${job.id} processed successfully.`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markJobAsFailed(job.id, message);
    throw error;
  }
}

export async function processAllJobs() {
  try {
    // Start the worker script as a background process
    const { stdout, stderr } = await execAsync('npm run process-embeddings');
    console.log('Worker process started:', stdout);
    if (stderr) {
      console.error('Worker process stderr:', stderr);
    }
    return {
      success: true,
      message: 'Embedding worker process started in the background.',
    };
  } catch (error) {
    console.error('Failed to start embedding worker process:', error);
    throw new Error('Failed to start embedding worker process.');
  }
}

export async function getLatestJobForLibrary(libraryId: string) {
  const { rows } = await pool.query(
    'SELECT job_id FROM embedding_jobs WHERE library_id = $1 ORDER BY created_at DESC LIMIT 1',
    [libraryId],
  );

  if (rows.length === 0) {
    return { jobId: null };
  }

  return { jobId: rows[0].job_id };
}
