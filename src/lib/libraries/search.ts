import { embed } from 'ai';
import { openai } from '../ai/service';
import pool from '../db';
import { LibrarySearchResult } from '../types';

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

export async function fetchLibraryDocumentation(
  libraryId: string,
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
          embeddings
        WHERE
          library_id = $1
        ORDER BY
          similarity_score DESC
        LIMIT 20
      ),
      keyword_search AS (
        SELECT
          vector_id,
          ts_rank(fts, plainto_tsquery('english', $3)) as keyword_score
        FROM
          embeddings
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
        embeddings se
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
    queryParams = [libraryId, `[${embedding.join(',')}]`, options.topic];
  } else {
    query = `
      SELECT
        ${baseQueryFields}
      FROM
        embeddings se
      WHERE
        library_id = $1
    `;
    queryParams = [libraryId];
  }

  const { rows } = await pool.query(query, queryParams);

  if (rows.length === 0) {
    return 'No documentation found for this library.';
  }

  const formattedResults = rows.map((row) => {
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
        return row.original_text.trim();
    }
  });

  return formattedResults.join('\n\n--------------------------------\n\n');
}
