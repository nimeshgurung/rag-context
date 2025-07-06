import { embed, embedMany } from 'ai';
import { OpenAPIV3 } from 'openapi-types';
import slug from 'slug';
import path from 'path';
import fs from 'fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import { openai } from '../ai/service';
import pool from '../db';
import { ApiSpecSource } from '../types';
import { sendEvent, closeConnection } from '../events';
import { SlopChunk } from '../../types';
import { convertToSlopChunks } from '../../slop/converter';

export async function handleApiSpecSource(
  jobId: string,
  source: ApiSpecSource,
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
      message: 'Library entry created. Storing spec file...',
    });
    const storageDir = path.join(process.cwd(), 'storage', 'specs');
    await fs.mkdir(storageDir, { recursive: true });

    const extension =
      source.sourceType === 'file' && source.content.trim().startsWith('{')
        ? 'json'
        : 'yaml';
    const filePath = path.join(storageDir, `${libraryId}.${extension}`);
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
        message: `Library ${libraryId} created, but no content was ingested.`,
      });
      return;
    }

    sendEvent(jobId, {
      type: 'progress',
      message: `Embedding ${chunks.length} content chunks...`,
    });
    const { embeddings: chunkEmbeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: chunks.map((chunk) => chunk.originalText),
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = chunkEmbeddings[i];
        const query = `
          INSERT INTO slop_embeddings (vector_id, library_id, content_type, original_text, embedding, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (vector_id) DO NOTHING;
        `;
        await client.query(query, [
          chunk.id,
          chunk.libraryId,
          chunk.contentType,
          chunk.originalText,
          `[${embedding.join(',')}]`,
          chunk.metadata,
        ]);
        if ((i + 1) % 5 === 0) {
          sendEvent(jobId, {
            type: 'progress',
            message: `Processed ${i + 1} of ${chunks.length} chunks...`,
          });
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    closeConnection(jobId, {
      type: 'done',
      message: `Library ${libraryId} created and ingested successfully.`,
    });
  } catch (error) {
    console.error(`[Job ${jobId}] Error in handleApiSpecSource:`, error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    closeConnection(jobId, { type: 'error', message });
  }
}
