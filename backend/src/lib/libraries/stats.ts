import { db } from '../db';
import { embeddings, embeddingJobs } from '../schema';
import { sql, eq, and, inArray } from 'drizzle-orm';

/**
 * Library statistics interface for GitLab/WebScrape content only
 */
export interface LibraryStats {
  libraryId: string;
  totalChunks: number;
  totalSnippets: number;
  totalTokens: number;
}

/**
 * Get aggregated statistics for a library, limited to GitLab and WebScrape content.
 * This excludes API Spec ingestions from the stats as per requirements.
 *
 * @param libraryId - The ID of the library to get stats for
 * @returns Promise<LibraryStats> - The aggregated statistics
 */
export async function getLibraryStats(libraryId: string): Promise<LibraryStats> {
  try {
    // Query that joins embeddings with embedding_jobs to filter by source_type
    // Only include 'gitlab-repo' and 'web-scrape' source types
    const result = await db
      .select({
        totalChunks: sql<number>`COUNT(*)`.as('total_chunks'),
        totalSnippets: sql<number>`SUM(COALESCE((${embeddings.metadata}->>'snippetCount')::INTEGER, 0))`.as('total_snippets'),
        totalTokens: sql<number>`SUM(COALESCE(${embeddings.tokenCount}, 0))`.as('total_tokens'),
      })
      .from(embeddings)
      .innerJoin(embeddingJobs, eq(embeddings.jobId, embeddingJobs.id))
      .where(
        and(
          eq(embeddings.libraryId, libraryId),
          inArray(embeddingJobs.sourceType, ['gitlab-repo', 'web-scrape'])
        )
      );

    // If no results, return zeros
    if (!result || result.length === 0) {
      return {
        libraryId,
        totalChunks: 0,
        totalSnippets: 0,
        totalTokens: 0,
      };
    }

    const stats = result[0];
    return {
      libraryId,
      totalChunks: Number(stats.totalChunks) || 0,
      totalSnippets: Number(stats.totalSnippets) || 0,
      totalTokens: Number(stats.totalTokens) || 0,
    };
  } catch (error) {
    console.error(`Error getting library stats for ${libraryId}:`, error);
    // Return zeros on error to prevent API failures
    return {
      libraryId,
      totalChunks: 0,
      totalSnippets: 0,
      totalTokens: 0,
    };
  }
}

/**
 * Get statistics for multiple libraries at once.
 * Useful for dashboard views or bulk operations.
 *
 * @param libraryIds - Array of library IDs to get stats for
 * @returns Promise<LibraryStats[]> - Array of library statistics
 */
export async function getMultipleLibraryStats(libraryIds: string[]): Promise<LibraryStats[]> {
  if (!libraryIds || libraryIds.length === 0) {
    return [];
  }

  try {
    // Query that groups by library_id to get stats for multiple libraries
    const result = await db
      .select({
        libraryId: embeddings.libraryId,
        totalChunks: sql<number>`COUNT(*)`.as('total_chunks'),
        totalSnippets: sql<number>`SUM(COALESCE((${embeddings.metadata}->>'snippetCount')::INTEGER, 0))`.as('total_snippets'),
        totalTokens: sql<number>`SUM(COALESCE(${embeddings.tokenCount}, 0))`.as('total_tokens'),
      })
      .from(embeddings)
      .innerJoin(embeddingJobs, eq(embeddings.jobId, embeddingJobs.id))
      .where(
        and(
          inArray(embeddings.libraryId, libraryIds),
          inArray(embeddingJobs.sourceType, ['gitlab-repo', 'web-scrape'])
        )
      )
      .groupBy(embeddings.libraryId);

    // Create a map for quick lookup
    const statsMap = new Map<string, LibraryStats>();
    result.forEach(stats => {
      statsMap.set(stats.libraryId, {
        libraryId: stats.libraryId,
        totalChunks: Number(stats.totalChunks) || 0,
        totalSnippets: Number(stats.totalSnippets) || 0,
        totalTokens: Number(stats.totalTokens) || 0,
      });
    });

    // Return stats for all requested libraries, with zeros for missing ones
    return libraryIds.map(libraryId =>
      statsMap.get(libraryId) || {
        libraryId,
        totalChunks: 0,
        totalSnippets: 0,
        totalTokens: 0,
      }
    );
  } catch (error) {
    console.error('Error getting multiple library stats:', error);
    // Return zeros for all libraries on error
    return libraryIds.map(libraryId => ({
      libraryId,
      totalChunks: 0,
      totalSnippets: 0,
      totalTokens: 0,
    }));
  }
}

/**
 * Check if a library has any GitLab/WebScrape content.
 * Useful for determining whether to show stats UI elements.
 *
 * @param libraryId - The ID of the library to check
 * @returns Promise<boolean> - True if library has GitLab/WebScrape content
 */
export async function hasDocumentationContent(libraryId: string): Promise<boolean> {
  try {
    const result = await db
      .select({
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(embeddings)
      .innerJoin(embeddingJobs, eq(embeddings.jobId, embeddingJobs.id))
      .where(
        and(
          eq(embeddings.libraryId, libraryId),
          inArray(embeddingJobs.sourceType, ['gitlab-repo', 'web-scrape'])
        )
      );

    return result && result.length > 0 && Number(result[0].count) > 0;
  } catch (error) {
    console.error(`Error checking documentation content for ${libraryId}:`, error);
    return false;
  }
}
