import { v4 as uuidv4 } from 'uuid';
import slug from 'slug';
import { embed } from 'ai';
import pool from '../db';
import { WebScrapeSource } from '../types';
import { crawlSingleSource } from '../crawl/crawler';
import { spawn } from 'child_process';
import { openai } from '../ai/service';
import { getEnrichedDataFromLLM } from '../embedding/enrichment';
import { markJobAsCompleted, markJobAsFailed } from './storage';
import {
  saveDocumentationChunks,
  saveEnrichedCodeSnippets,
} from '../embedding/saveEnrichedData';
import { EnrichedItem } from '../types';

export async function startCrawlJob(
  libraryName: string,
  libraryDescription: string,
  startUrl: string,
  scrapeType: 'code' | 'documentation',
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
      config: {
        scrapeType,
      },
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

export async function deleteJob(jobItemId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the source_url from the job to be deleted
    const jobResult = await client.query(
      'SELECT source_url, library_id FROM embedding_jobs WHERE id = $1',
      [jobItemId],
    );

    if (jobResult.rows.length === 0) {
      throw new Error(`Job item with ID ${jobItemId} not found.`);
    }
    const { source_url: sourceUrl, library_id: libraryId } = jobResult.rows[0];

    // Delete associated embeddings from slop_embeddings
    await client.query(
      "DELETE FROM slop_embeddings WHERE library_id = $1 AND metadata->>'source' = $2",
      [libraryId, sourceUrl],
    );

    // Delete the job from embedding_jobs
    await client.query('DELETE FROM embedding_jobs WHERE id = $1', [jobItemId]);

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

    if (job.scrape_type === 'documentation') {
      await saveDocumentationChunks(
        job.raw_snippets,
        {
          libraryId: job.library_id,
          libraryName: job.library_name,
          libraryDescription: job.library_description,
        },
        job.source_url,
      );
    } else {
      const enrichedItems: EnrichedItem[] = [];
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
        await saveEnrichedCodeSnippets(
          enrichedItems,
          {
            libraryId: job.library_id,
            libraryName: job.library_name,
            libraryDescription: job.library_description,
          },
          job.source_url,
        );
      }
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

export async function processAllJobs(jobId: string) {
  try {
    const workerCommand = 'npm';
    const workerArgs = ['run', 'process-all', '--', jobId];

    console.log(
      `Spawning worker for jobId: ${jobId} with command: ${workerCommand} ${workerArgs.join(
        ' ',
      )}`,
    );

    const child = spawn(workerCommand, workerArgs, {
      detached: true,
      stdio: 'inherit', // This pipes the child's logs to the parent
    });

    child.on('error', (err) => {
      console.error(`Failed to start worker process for jobId ${jobId}:`, err);
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
