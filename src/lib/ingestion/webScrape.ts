import { embed } from 'ai';
import slug from 'slug';
import { openai } from '../ai/service';
import pool from '../db';
import { WebScrapeSource } from '../types';
import { sendEvent, closeConnection } from '../events';
import { crawlSingleSource } from '../crawl/crawler';

export async function handleWebScrapeSource(
  jobId: string,
  source: WebScrapeSource,
) {
  try {
    sendEvent(jobId, {
      type: 'progress',
      message: 'Creating library entry...',
    });
    const libraryId = slug(source.name);

    const { rows: existing } = await pool.query(
      'SELECT id FROM libraries WHERE id = $1',
      [libraryId],
    );
    if (existing.length > 0) {
      throw new Error(`Library with name "${source.name}" already exists.`);
    }

    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: `${source.name}: ${source.description}`,
    });

    await pool.query(
      'INSERT INTO libraries (id, name, description, embedding) VALUES ($1, $2, $3, $4)',
      [libraryId, source.name, source.description, `[${embedding.join(',')}]`],
    );

    sendEvent(jobId, {
      type: 'progress',
      message: 'Library entry created. Starting web crawl...',
    });

    await crawlSingleSource(jobId, source, libraryId, source.description);

    closeConnection(jobId, {
      type: 'done',
      message: `Library ${libraryId} crawled and ingested successfully.`,
    });
  } catch (error) {
    console.error(`[Job ${jobId}] Error in handleWebScrapeSource:`, error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    closeConnection(jobId, { type: 'error', message });
  }
}
