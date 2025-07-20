import { embed } from 'ai';
import { models } from '../ai/models';
import { db } from '../db';
import { libraries, embeddings } from '../db/schema';
import { sql, placeholder } from 'drizzle-orm';
import { LibrarySearchResult } from '../types';

export async function searchLibraries(
  libraryName: string,
): Promise<LibrarySearchResult[]> {
  const { embedding } = await embed({
    model: models['text-embedding-3-small'],
    value: libraryName,
  });

  // Complex hybrid search using Drizzle's sql template for pgvector operations
  const query = sql`
    WITH vector_search AS (
      SELECT
        id,
        1 - (embedding <=> ${`[${embedding.join(',')}]`}) as similarity_score
      FROM
        libraries
      ORDER BY
        similarity_score DESC
      LIMIT 10
    ),
    keyword_search AS (
      SELECT
        id,
        ts_rank(fts, plainto_tsquery('english', ${libraryName})) as keyword_score
      FROM
        libraries
      WHERE
        fts @@ plainto_tsquery('english', ${libraryName})
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
    LIMIT 5
  `;

  const result = await db.execute(query);
  return result.rows.map((row: any) => ({
    libraryId: row.libraryId,
    name: row.name,
    description: row.description || '',
    similarityScore: row.similarityScore || 0,
    keywordScore: row.keywordScore || 0,
    hybridScore: row.hybridScore || 0,
  }));
}

export async function fetchLibraryDocumentation(
  libraryId: string,
  options: { tokens?: number; topic?: string } = {},
): Promise<string> {
  let rows;

  if (options.topic) {
    const { embedding } = await embed({
      model: models['text-embedding-3-small'],
      value: options.topic,
    });
    
    // Complex hybrid search with topic similarity
    const query = sql`
      WITH vector_search AS (
        SELECT
          vector_id,
          1 - (embedding <=> ${`[${embedding.join(',')}]`}) as similarity_score
        FROM
          embeddings
        WHERE
          library_id = ${libraryId}
        ORDER BY
          similarity_score DESC
        LIMIT 20
      ),
      keyword_search AS (
        SELECT
          vector_id,
          ts_rank(fts, plainto_tsquery('english', ${options.topic})) as keyword_score
        FROM
          embeddings
        WHERE
          library_id = ${libraryId} AND content_type IN ('OPERATION', 'SCHEMA_DEFINITION', 'API_OVERVIEW', 'guide', 'code-example')
          AND fts @@ plainto_tsquery('english', ${options.topic})
        ORDER BY
          keyword_score DESC
        LIMIT 20
      )
      SELECT
        se.vector_id,
        se.original_text,
        se.title,
        se.description,
        se.content_type,
        se.metadata,
        COALESCE(vs.similarity_score, 0) as "similarityScore",
        COALESCE(ks.keyword_score, 0) as "keywordScore",
        (COALESCE(vs.similarity_score, 0) * 0.7 + COALESCE(ks.keyword_score, 0) * 0.3) as "hybridScore"
      FROM
        embeddings se
      LEFT JOIN
        vector_search vs ON se.vector_id = vs.vector_id
      LEFT JOIN
        keyword_search ks ON se.vector_id = ks.vector_id
      WHERE
        se.vector_id IN (SELECT vector_id FROM vector_search UNION SELECT vector_id FROM keyword_search)
      ORDER BY
        "hybridScore" DESC
      LIMIT 5
    `;
    
    const result = await db.execute(query);
    rows = result.rows;
  } else {
    // Simple query to get all embeddings for the library
    const query = sql`
      SELECT
        vector_id,
        original_text,
        title,
        description,
        content_type,
        metadata
      FROM
        embeddings
      WHERE
        library_id = ${libraryId}
    `;
    
    const result = await db.execute(query);
    rows = result.rows;
  }

  if (rows.length === 0) {
    return 'No documentation found for this library.';
  }

  const formattedResults = rows.map((row: any) => {
    switch (row.content_type) {
      case 'code':
        return `
### ${row.title || 'Code Example'} \n\n
**Description:** ${row.description || 'N/A'} \n\n
\`\`\`${row.metadata?.language || ''}
${row.original_text}
\`\`\` \n\n
        `.trim();
      default:
        return String(row.original_text).trim();
    }
  });

  return formattedResults.join('\n\n--------------------------------\n\n');
}
