import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { embed, generateObject } from 'ai';
import { LibrarySearchResult } from './types';
import pool from './db';
import { z } from 'zod';

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

// Initialize PostgreSQL client pool
// const pool = new Pool({
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   host: process.env.DB_HOST || 'db',
//   port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
// });

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

  const baseQueryFields = `
    original_text,
    title,
    description,
    content_type,
    metadata
  `;

  if (options.topic) {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: options.topic,
    });
    query = `
      SELECT
        ${baseQueryFields}
      FROM
        slop_embeddings
      WHERE
        library_id = $1 AND content_type IN ('OPERATION', 'SCHEMA_DEFINITION', 'API_OVERVIEW', 'guide', 'code-example')
      ORDER BY
        embedding <=> $2
      LIMIT 10;
    `;
    queryParams = [context7CompatibleLibraryID, `[${embedding.join(',')}]`];
  } else {
    query = `
      SELECT
        ${baseQueryFields}
      FROM
        slop_embeddings
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
### ${row.title || 'Code Example'}
**Description:** ${row.description || 'N/A'}
\`\`\`${row.metadata?.language || ''}
${row.original_text}
\`\`\`
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
