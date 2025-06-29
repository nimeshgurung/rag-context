import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { embed, embedMany, generateObject } from 'ai';
import {
  LibrarySearchResult,
  DocumentationSource,
  ApiSpecSource,
  WebScrapeSource,
} from './types';
import pool from './db';
import { z } from 'zod';
import slug from 'slug';
import path from 'path';
import fs from 'fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import { convertToSlopChunks } from '../slop/converter';
import { SlopChunk } from '../types';
import { crawlSingleSource } from './crawler/main';
import { sendEvent, closeConnection } from './events';

// Initialize OpenAI client
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateObjectFromPrompt<T extends z.ZodTypeAny>({
  prompt,
  systemPrompt,
  schema,
  model = 'gpt-4o-mini',
}: {
  prompt: string;
  systemPrompt: string;
  schema: T;
  model?: string;
}): Promise<z.infer<T>> {
  const { object } = await generateObject({
    model: openai(model),
    schema,
    prompt,
    system: systemPrompt,
  });
  return object;
}

export async function searchLibraries(
  libraryName: string,
): Promise<LibrarySearchResult[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: libraryName,
  });

  const query = `
    WITH vector_search AS (
      SELECT
        id,
        1 - (embedding <=> $1) as similarity_score
      FROM
        libraries
      ORDER BY
        similarity_score DESC
      LIMIT 10
    ),
    keyword_search AS (
      SELECT
        id,
        ts_rank(fts, plainto_tsquery('english', $2)) as keyword_score
      FROM
        libraries
      WHERE
        fts @@ plainto_tsquery('english', $2)
      ORDER BY
        keyword_score DESC
      LIMIT 10
    )
    SELECT
      l.id as "libraryId",
      l.name,
      l.description,
      COALESCE(vs.similarity_score, 0) as "similarityScore",
      COALESCE(ks.keyword_score, 0) as "keywordScore",
      (COALESCE(vs.similarity_score, 0) * 0.7 + COALESCE(ks.keyword_score, 0) * 0.3) as "hybridScore"
    FROM
      libraries l
    LEFT JOIN
      vector_search vs ON l.id = vs.id
    LEFT JOIN
      keyword_search ks ON l.id = ks.id
    WHERE
      l.id IN (SELECT id FROM vector_search UNION SELECT id FROM keyword_search)
    ORDER BY
      "hybridScore" DESC
    LIMIT 5;
  `;

  const { rows } = await pool.query(query, [
    `[${embedding.join(',')}]`,
    libraryName,
  ]);

  return rows;
}

export async function getUniqueLibraries(): Promise<LibrarySearchResult[]> {
  const query =
    'SELECT id as "libraryId", name, description FROM libraries ORDER BY name ASC;';
  const { rows } = await pool.query(query);
  return rows;
}

export async function fetchLibraryDocumentation(
  context7CompatibleLibraryID: string,
  options: { tokens?: number; topic?: string } = {},
): Promise<string> {
  let query;
  let queryParams;

  const baseQueryFields = `
    se.vector_id,
    se.original_text,
    se.title,
    se.description,
    se.content_type,
    se.metadata
  `;

  if (options.topic) {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: options.topic,
    });
    query = `
      WITH vector_search AS (
        SELECT
          vector_id,
          1 - (embedding <=> $2) as similarity_score
        FROM
          slop_embeddings
        WHERE
          library_id = $1 AND content_type IN ('OPERATION', 'SCHEMA_DEFINITION', 'API_OVERVIEW', 'guide', 'code-example')
        ORDER BY
          similarity_score DESC
        LIMIT 20
      ),
      keyword_search AS (
        SELECT
          vector_id,
          ts_rank(fts, plainto_tsquery('english', $3)) as keyword_score
        FROM
          slop_embeddings
        WHERE
          library_id = $1 AND content_type IN ('OPERATION', 'SCHEMA_DEFINITION', 'API_OVERVIEW', 'guide', 'code-example')
          AND fts @@ plainto_tsquery('english', $3)
        ORDER BY
          keyword_score DESC
        LIMIT 20
      )
      SELECT
        ${baseQueryFields},
        COALESCE(vs.similarity_score, 0) as "similarityScore",
        COALESCE(ks.keyword_score, 0) as "keywordScore",
        (COALESCE(vs.similarity_score, 0) * 0.7 + COALESCE(ks.keyword_score, 0) * 0.3) as "hybridScore"
      FROM
        slop_embeddings se
      LEFT JOIN
        vector_search vs ON se.vector_id = vs.vector_id
      LEFT JOIN
        keyword_search ks ON se.vector_id = ks.vector_id
      WHERE
        se.vector_id IN (SELECT vector_id FROM vector_search UNION SELECT vector_id FROM keyword_search)
      ORDER BY
        "hybridScore" DESC
      LIMIT 5;
    `;
    queryParams = [
      context7CompatibleLibraryID,
      `[${embedding.join(',')}]`,
      options.topic,
    ];
  } else {
    query = `
      SELECT
        ${baseQueryFields}
      FROM
        slop_embeddings se
      WHERE
        library_id = $1 AND content_type IN ('OPERATION', 'SCHEMA_DEFINITION', 'API_OVERVIEW', 'guide', 'code-example');
    `;
    queryParams = [context7CompatibleLibraryID];
  }

  const { rows } = await pool.query(query, queryParams);

  if (rows.length === 0) {
    return 'No documentation found for this library.';
  }

  const formattedResults = rows.map((row) => {
    switch (row.content_type) {
      case 'code-example':
        return `
### ${row.title || 'Code Example'} \n\n
**Description:** ${row.description || 'N/A'} \n\n
\`\`\`${row.metadata?.language || ''}
${row.original_text}
\`\`\` \n\n
        `.trim();
      case 'guide':
        return `
## ${row.title || 'Guide'}
${row.original_text}
        `.trim();
      default:
        return row.original_text;
    }
  });

  return formattedResults.join('\n\n---\n\n');
}

async function handleApiSpecSource(jobId: string, source: ApiSpecSource) {
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

async function handleWebScrapeSource(jobId: string, source: WebScrapeSource) {
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

export async function addDocumentationSource(
  jobId: string,
  source: DocumentationSource,
) {
  try {
    if (source.type === 'api-spec') {
      await handleApiSpecSource(jobId, source);
    } else if (source.type === 'web-scrape') {
      await handleWebScrapeSource(jobId, source);
    } else {
      throw new Error('Unknown documentation source type');
    }
  } catch (error) {
    console.error(
      `[Job ${jobId}] Failed to process documentation source:`,
      error,
    );
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    closeConnection(jobId, { type: 'error', message });
  }
}
