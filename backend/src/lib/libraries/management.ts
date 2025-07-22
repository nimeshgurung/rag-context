import { db } from '../db';
import { libraries, embeddings, embeddingJobs } from '../schema.js';
import { asc, eq } from 'drizzle-orm';
import { LibrarySearchResult } from '../types';

export async function getUniqueLibraries(): Promise<LibrarySearchResult[]> {
  const result = await db
    .select({
      id: libraries.id,
      name: libraries.name,
      description: libraries.description,
    })
    .from(libraries)
    .orderBy(asc(libraries.name));

  return result.map((row) => ({
    libraryId: row.id,
    name: row.name,
    description: row.description || '',
    similarityScore: 0,
    keywordScore: 0,
    hybridScore: 0,
  }));
}

export async function deleteLibrary(libraryId: string) {
  try {
    return await db.transaction(async (tx) => {
      // Delete all embeddings associated with the library
      await tx.delete(embeddings).where(eq(embeddings.libraryId, libraryId));

      // Delete all embedding jobs associated with the library
      await tx.delete(embeddingJobs).where(eq(embeddingJobs.libraryId, libraryId));

      // Delete the library itself
      await tx.delete(libraries).where(eq(libraries.id, libraryId));

      return {
        success: true,
        message: `Library ${libraryId} and all associated data have been deleted.`,
      };
    });
  } catch (error) {
    console.error(`Failed to delete library ${libraryId}:`, error);
    throw new Error(`Failed to delete library ${libraryId}.`);
  }
}
