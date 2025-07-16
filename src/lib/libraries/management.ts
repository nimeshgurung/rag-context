import pool from '../db';
import { LibrarySearchResult } from '../types';

export async function getUniqueLibraries(): Promise<LibrarySearchResult[]> {
  const result = await pool.query(
    'SELECT id, name, description FROM libraries ORDER BY name ASC;',
  );
  return result.rows.map((row) => ({
    libraryId: row.id,
    name: row.name,
    description: row.description,
    similarityScore: 0,
    keywordScore: 0,
    hybridScore: 0,
  }));
}

export async function deleteLibrary(libraryId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete all embeddings associated with the library
    await client.query('DELETE FROM embeddings WHERE library_id = $1', [
      libraryId,
    ]);

    // Delete all embedding jobs associated with the library
    await client.query('DELETE FROM embedding_jobs WHERE library_id = $1', [
      libraryId,
    ]);

    // Delete the library itself
    await client.query('DELETE FROM libraries WHERE id = $1', [libraryId]);

    await client.query('COMMIT');
    return {
      success: true,
      message: `Library ${libraryId} and all associated data have been deleted.`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to delete library ${libraryId}:`, error);
    throw new Error(`Failed to delete library ${libraryId}.`);
  } finally {
    client.release();
  }
}
