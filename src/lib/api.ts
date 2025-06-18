import 'dotenv/config';
import { Pool } from 'pg';
import { createOpenAI } from '@ai-sdk/openai';
import { embed } from 'ai';
import { LibrarySearchResult } from './types';

// Initialize OpenAI client
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize PostgreSQL client pool
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
});

export async function searchLibraries(
  libraryName: string,
): Promise<LibrarySearchResult[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: libraryName,
  });

  const query = `
    SELECT
      library_id as "libraryId",
      metadata->>'title' as name,
      metadata->>'description' as description,
      1 - (embedding <=> $1) as "similarityScore"
    FROM
      slop_embeddings
    WHERE
      content_type = 'API_OVERVIEW'
    ORDER BY
      "similarityScore" DESC
    LIMIT 5;
  `;

  const { rows } = await pool.query(query, [`[${embedding.join(',')}]`]);

  return rows;
}

export async function fetchLibraryDocumentation(
  context7CompatibleLibraryID: string,
  options: { tokens?: number; topic?: string } = {},
): Promise<string> {
  let query;
  let queryParams;

  if (options.topic) {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: options.topic,
    });
    query = `
      SELECT
        original_text
      FROM
        slop_embeddings
      WHERE
        library_id = $1 AND content_type IN ('OPERATION', 'SCHEMA_DEFINITION', 'API_OVERVIEW')
      ORDER BY
        embedding <=> $2
      LIMIT 10;
    `;
    queryParams = [context7CompatibleLibraryID, `[${embedding.join(',')}]`];
  } else {
    query = `
      SELECT
        original_text
      FROM
        slop_embeddings
      WHERE
        library_id = $1 AND content_type IN ('OPERATION', 'SCHEMA_DEFINITION', 'API_OVERVIEW');
    `;
    queryParams = [context7CompatibleLibraryID];
  }

  const { rows } = await pool.query(query, queryParams);

  if (rows.length === 0) {
    return 'No documentation found for this library.';
  }

  return rows.map((row) => row.original_text).join('\n\n---\n\n');
}
