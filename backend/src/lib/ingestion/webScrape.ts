import slug from 'slug';
import { db } from '../db';
import { libraries } from '../schema';
import { eq } from 'drizzle-orm';
import { WebScrapeSource } from '../types';
import { sendEvent, sendMultiEvent } from '../events';
import { crawlSource } from '../crawl/crawler';
import { ragService } from '../rag/service';

export async function handleWebScrapeSource(
  jobId: string,
  source: WebScrapeSource,
  existingLibraryId?: string,
) {
  try {
    let libraryId: string;
    let libraryName: string;
    let libraryDescription: string;

    if (existingLibraryId) {
      // Add to existing library
      libraryId = existingLibraryId;

      // Verify library exists and get its actual name and description
      const existing = await db
        .select({
          id: libraries.id,
          name: libraries.name,
          description: libraries.description,
        })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .limit(1);

      if (existing.length === 0) {
        throw new Error(`Library with id "${libraryId}" does not exist.`);
      }

      // Use the actual library name and description from database
      libraryName = existing[0].name;
      libraryDescription = existing[0].description;

      // Send events to both job and library channels
      sendMultiEvent([jobId, libraryId], {
        type: 'resource:adding',
        message: `Adding resource to existing library: ${libraryName}`,
        jobId,
        libraryId,
        resourceType: 'web-scrape',
        source,
      });
    } else {
      // Create new library (existing behavior)
      sendEvent(jobId, {
        type: 'progress',
        message: 'Creating library entry...',
      });

      libraryId = slug(source.name);
      libraryName = source.name;
      libraryDescription = source.description;

      // Validate that description is not empty
      if (!libraryDescription || libraryDescription.trim() === '') {
        throw new Error('Library description is required and cannot be empty.');
      }

      const existing = await db
        .select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.id, libraryId))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(`Library with name "${libraryName}" already exists.`);
      }

      await ragService.upsertLibrary({
        id: libraryId,
        name: libraryName,
        description: libraryDescription,
      });

      // Send events to both job and library channels
      sendMultiEvent([jobId, libraryId], {
        type: 'library:created',
        message: 'Library entry created. Starting web crawl...',
        jobId,
        libraryId,
        name: libraryName,
        description: libraryDescription,
      });

      // Also send to global library channel for library list updates
      sendEvent('global', {
        type: 'library:created',
        libraryId,
        name: libraryName,
        description: libraryDescription,
      });
    }

    // Pass the correct library name and description (not the source's!)
    await crawlSource(
      jobId,
      source,
      libraryId,
      libraryName,
      libraryDescription,
    );

    // Send completion events to both channels
    const finalMessage = existingLibraryId
      ? `Resource added to library ${libraryId} successfully.`
      : `Library ${libraryId} crawled and ingested successfully.`;

    sendMultiEvent([jobId, libraryId], {
      type: existingLibraryId ? 'resource:added' : 'library:completed',
      message: finalMessage,
      jobId,
      libraryId,
    });

    // Send final event to job channel only
    sendEvent(jobId, {
      type: 'done',
      message: finalMessage,
    });
  } catch (error) {
    console.error(`[Job ${jobId}] Error in handleWebScrapeSource:`, error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';

    // Send error to job channel
    sendEvent(jobId, { type: 'error', message });
  }
}
