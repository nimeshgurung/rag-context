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
  existingLibraryId?: string,
) {
  try {
    let libraryId: string;
    
    if (existingLibraryId) {
      // Use existing library
      libraryId = existingLibraryId;
      
      // Verify library exists
      const { rows: existing } = await pool.query(
        'SELECT id, name, description FROM libraries WHERE id = $1',
        [libraryId],
      );
      
      if (existing.length === 0) {
        throw new Error(`Library with id "${libraryId}" does not exist.`);
      }
      
      sendEvent(jobId, {
        type: 'progress',
        message: `Adding resource to existing library: ${existing[0].name}`,
      });
    } else {
      // Create new library (existing behavior)
      sendEvent(jobId, {
        type: 'progress',
        message: 'Creating library entry...',
      });
      
      libraryId = slug(source.name);

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
    }

    // Always crawl the source
    await crawlSingleSource(jobId, source, libraryId, source.description);

    closeConnection(jobId, {
      type: 'done',
      message: existingLibraryId 
        ? `Resource added to library ${libraryId} successfully.`
        : `Library ${libraryId} crawled and ingested successfully.`,
    });
  } catch (error) {
    console.error(`[Job ${jobId}] Error in handleWebScrapeSource:`, error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    closeConnection(jobId, { type: 'error', message });
  }
}
