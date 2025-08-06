import slug from 'slug';
import path from 'path';
import fs from 'fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import { ApiSpecSource } from '../types';
import { sendEvent, sendMultiEvent } from '../events';
import { SlopChunk } from '../../types';
import { convertToSlopChunks } from '../../slop/converter';
import { ragService } from '../rag/service';
import { db } from '../db';
import { libraries } from '../schema.js';
import { eq } from 'drizzle-orm';

export async function handleApiSpecSource(
  jobId: string,
  source: ApiSpecSource,
  existingLibraryId?: string,
) {
  try {
    let libraryId: string;
    let libraryName: string = '';
    let libraryDescription: string = '';

    if (existingLibraryId) {
      // Use existing library
      libraryId = existingLibraryId;

      // For existing libraries, we need to fetch the name and description
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

      libraryName = existing[0].name;
      libraryDescription = existing[0].description;

      // Send events to both job and library channels
      sendMultiEvent([jobId, libraryId], {
        type: 'resource:adding',
        message: 'Adding API spec to existing library...',
        jobId,
        libraryId,
        resourceType: 'api-spec',
        source,
      });
    } else {
      libraryName = source.name;
      libraryDescription = source.description;
      libraryId = slug(libraryName);

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

      sendEvent(jobId, {
        type: 'progress',
        message: 'Creating library entry...',
      });

      await ragService.upsertLibrary({
        id: libraryId,
        name: libraryName,
        description: libraryDescription,
      });

      // Send library created event to both channels
      sendMultiEvent([jobId, libraryId], {
        type: 'library:created',
        message: 'Library entry created.',
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

    // Store spec file
    sendEvent(jobId, {
      type: 'progress',
      message: 'Storing spec file...',
    });

    const storageDir = path.join(process.cwd(), 'storage', 'specs');
    await fs.mkdir(storageDir, { recursive: true });

    const extension =
      source.sourceType === 'file' && source.content.trim().startsWith('{')
        ? 'json'
        : 'yaml';

    const filename = existingLibraryId
      ? `${libraryId}_${Date.now()}.${extension}`
      : `${libraryId}.${extension}`;

    const filePath = path.join(storageDir, filename);
    await fs.writeFile(filePath, source.content);

    sendEvent(jobId, {
      type: 'progress',
      message: 'Parsing API specification...',
    });
    const spec = (await SwaggerParser.bundle(filePath)) as OpenAPIV3.Document;
    const chunks: SlopChunk[] = convertToSlopChunks(libraryId, spec);

    if (chunks.length === 0) {
      sendMultiEvent([jobId, libraryId], {
        type: 'resource:added',
        message: existingLibraryId
          ? `API spec added to library ${libraryId}, but no content was ingested.`
          : `Library ${libraryId} created, but no content was ingested.`,
        jobId,
        libraryId,
        resourceType: 'api-spec',
        source,
      });
      return;
    }

    sendEvent(jobId, {
      type: 'progress',
      message: `Ingesting ${chunks.length} content chunks...`,
    });

    const itemsToIngest = chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.content,
      metadata: {
        library_id: chunk.libraryId,
        content_type: chunk.contentType,
        ...chunk.metadata,
      },
    }));

    await ragService.ingestApiSpec(
      {
        libraryId,
        libraryName,
        libraryDescription,
      },
      itemsToIngest,
      source.sourceType === 'file' ? 'uploaded-api-spec' : 'pasted-api-spec',
    );

    sendEvent(jobId, {
      type: 'progress',
      message: 'Ingestion complete.',
    });

    const metadata = {
      specInfo: spec.info,
      chunksGenerated: chunks.length,
    };

    // Send completion events to both channels
    const finalMessage = existingLibraryId
      ? `API spec added to library ${libraryId} successfully. Generated ${chunks.length} chunks.`
      : `API spec ingested successfully for library ${libraryId}. Generated ${chunks.length} chunks.`;

    sendMultiEvent([jobId, libraryId], {
      type: existingLibraryId ? 'resource:added' : 'library:completed',
      message: finalMessage,
      jobId,
      libraryId,
      metadata,
    });

    sendEvent(jobId, {
      type: 'done',
      message: finalMessage,
      metadata,
    });
  } catch (error) {
    console.error(`[Job ${jobId}] Error in handleApiSpecSource:`, error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    sendEvent(jobId, { type: 'error', message });
  }
}
