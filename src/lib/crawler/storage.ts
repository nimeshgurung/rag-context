import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { EnrichedItem } from '../types';

export async function saveEnrichedData(
  data: EnrichedItem[],
  libraryId: string,
  sourceUrl: string,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of data) {
      const vectorId = uuidv4();
      const query = `
        INSERT INTO slop_embeddings (vector_id, library_id, content_type, title, description, original_text, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      const values = [
        vectorId,
        libraryId,
        'code-example',
        item.title,
        item.description,
        item.code,
        { source: sourceUrl, language: item.language },
      ];
      await client.query(query, values);
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
