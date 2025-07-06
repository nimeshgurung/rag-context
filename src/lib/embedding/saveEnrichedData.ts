import pool from '../db';
import { EnrichedItem } from '../types';
import { createHash } from 'crypto';
import { embed, embedMany } from 'ai';
import { openai } from '../api';

function generateDeterministicId(
  libraryId: string,
  sourceUrl: string,
  content: string,
): string {
  const input = `${libraryId}-${sourceUrl}-${content}`;
  return createHash('sha256').update(input).digest('hex');
}

export async function saveEnrichedData(
  data: EnrichedItem[],
  libraryInfo: {
    libraryId: string;
    libraryName: string;
    libraryDescription: string;
  },
  sourceUrl: string,
) {
  const libraryEmbeddingText = `${libraryInfo.libraryName}: ${libraryInfo.libraryDescription}`;
  const { embedding: libraryEmbedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: libraryEmbeddingText,
  });

  const { embeddings: chunkEmbeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: data.map((item) => item.code),
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First, ensure the library exists in the 'libraries' table.
    const libraryInsertQuery = `
      INSERT INTO libraries (id, name, description, embedding)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        embedding = EXCLUDED.embedding;
    `;
    await client.query(libraryInsertQuery, [
      libraryInfo.libraryId,
      libraryInfo.libraryName,
      libraryInfo.libraryDescription,
      `[${libraryEmbedding.join(',')}]`,
    ]);

    // Get existing vector IDs for this library and source URL
    const existingIdsResult = await client.query(
      "SELECT vector_id FROM slop_embeddings WHERE library_id = $1 AND metadata->>'source' = $2",
      [libraryInfo.libraryId, sourceUrl],
    );
    const existingIds = new Set(
      existingIdsResult.rows.map((row) => row.vector_id),
    );
    const currentIds = new Set<string>();

    for (const item of data) {
      const vectorId = generateDeterministicId(
        libraryInfo.libraryId,
        sourceUrl,
        item.code,
      );
      currentIds.add(vectorId);

      const embedding = chunkEmbeddings[data.indexOf(item)];

      const query = `
        INSERT INTO slop_embeddings (vector_id, library_id, content_type, title, description, original_text, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (vector_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          original_text = EXCLUDED.original_text,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata;
      `;
      const values = [
        vectorId,
        libraryInfo.libraryId,
        'code-example',
        item.title,
        item.description,
        item.code,
        `[${embedding.join(',')}]`,
        { source: sourceUrl, language: item.language },
      ];
      await client.query(query, values);
    }

    // Delete stale records
    const staleIds = [...existingIds].filter((id) => !currentIds.has(id));
    if (staleIds.length > 0) {
      await client.query(
        'DELETE FROM slop_embeddings WHERE vector_id = ANY($1::text[])',
        [staleIds],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving enriched data to database:', error);
    throw error;
  } finally {
    client.release();
  }
}
