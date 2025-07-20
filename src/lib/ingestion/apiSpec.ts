import slug from 'slug';
import path from 'path';
import fs from 'fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import { ApiSpecSource } from '../types';
import { sendEvent, closeConnection } from '../events';
import { SlopChunk } from '../../types';
import { convertToSlopChunks } from '../../slop/converter';
import { ragService } from '../rag/service';
import pool from '../db'; // Keep for checking existence

export async function handleApiSpecSource(
  jobId: string,
  source: ApiSpecSource,
  existingLibraryId?: string,
) {
  try {
    let libraryId: string;
    let libraryName: string;
    let libraryDescription: string;

    if (existingLibraryId) {
      libraryId = existingLibraryId;
      const { rows: existing } = await pool.query(
        'SELECT id, name, description FROM libraries WHERE id = $1',
        [libraryId],
      );

      if (existing.length === 0) {
        throw new Error(`Library with id "${libraryId}" does not exist.`);
      }
      libraryName = existing[0].name;
      libraryDescription = existing[0].description;

      sendEvent(jobId, {
        type: 'progress',
        message: `Adding API spec to existing library: ${libraryName}`,
      });
    } else {
      libraryName = source.name;
      libraryDescription = source.description;
      libraryId = slug(libraryName);

      const { rows: existing } = await pool.query(
        'SELECT id FROM libraries WHERE id = $1',
        [libraryId],
      );
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

      sendEvent(jobId, {
        type: 'progress',
        message: 'Library entry created.',
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
      closeConnection(jobId, {
        type: 'done',
        message: existingLibraryId
          ? `API spec added to library ${libraryId}, but no content was ingested.`
          : `Library ${libraryId} created, but no content was ingested.`,
      });
      return;
    }

    sendEvent(jobId, {
      type: 'progress',
      message: `Ingesting ${chunks.length} content chunks...`,
    });

    const itemsToIngest = chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.originalText,
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

    closeConnection(jobId, {
      type: 'done',
      message: existingLibraryId
        ? `API spec added to library ${libraryId} and ingested successfully.`
        : `Library ${libraryId} created and ingested successfully.`,
    });
  } catch (error) {
    console.error(`[Job ${jobId}] Error in handleApiSpecSource:`, error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    closeConnection(jobId, { type: 'error', message });
  }
}
