import { embed } from 'ai';
import { models } from '../ai/models';
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { LibrarySearchResult } from '../types';
import { embeddings } from '../schema.js';

// Type for the library search query result from stored procedure
interface LibrarySearchRow {
  library_id: string;
  name: string;
  description: string;
  similarity_score: number;
  keyword_score: number;
  hybrid_score: number;
}

// Type for the documentation search query result from stored procedure
interface DocumentationRow {
  vector_id: string;
  content: string;
  content_type: string;
  metadata: Record<string, unknown> | null;
  similarity_score?: number;
  keyword_score?: number;
  hybrid_score?: number;
}

// Type for search analytics result
interface SearchAnalyticsRow {
  total_libraries: number;
  libraries_with_embeddings: number;
  libraries_with_fts: number;
  avg_embedding_similarity: number;
  search_coverage_percent: number;
}

/**
 * ✨ STORED PROCEDURE - Complex hybrid search for libraries
 * Uses PostgreSQL function for optimal performance on complex operations
 */
export async function searchLibraries(
  libraryName: string,
  options: {
    vectorWeight?: number;
    keywordWeight?: number;
    limit?: number;
  } = {},
): Promise<LibrarySearchResult[]> {
  const { vectorWeight = 0.7, keywordWeight = 0.3, limit = 5 } = options;

  // 🎯 Generate embedding for vector search
  const { embedding } = await embed({
    model: models['text-embedding-3-small'],
    value: libraryName,
  });

  // 🚀 CALL STORED PROCEDURE - Complex hybrid search logic
  const result = await db.execute(
    sql`
      SELECT * FROM search_libraries_hybrid(
        ${libraryName}::TEXT,
        ${JSON.stringify(embedding)}::VECTOR(1536),
        ${vectorWeight}::DOUBLE PRECISION,
        ${keywordWeight}::DOUBLE PRECISION,
        ${limit}::INTEGER
      )
    `,
  );

  return (result.rows as unknown as LibrarySearchRow[]).map((row) => ({
    libraryId: row.library_id,
    name: row.name,
    description: row.description,
    similarityScore: row.similarity_score,
    keywordScore: row.keyword_score,
    hybridScore: row.hybrid_score,
  }));
}

/**
 * 🎯 HYBRID APPROACH - Complex searches use stored procedures, simple ones use Drizzle ORM
 * This gives us the best of both worlds: performance for complex operations, type safety for simple ones
 */
export async function fetchLibraryDocumentation(
  libraryId: string,
  options: {
    tokens?: number;
    topic?: string;
    vectorWeight?: number;
    keywordWeight?: number;
    limit?: number;
  } = {},
): Promise<string> {
  const { topic, vectorWeight = 0.7, keywordWeight = 0.3, limit = 5 } = options;

  let rows: DocumentationRow[];

  if (topic) {
    // 🚀 COMPLEX CASE: Use stored procedure for hybrid search
    const { embedding } = await embed({
      model: models['text-embedding-3-small'],
      value: topic,
    });

    const result = await db.execute(
      sql`
        SELECT * FROM search_library_documentation(
          ${libraryId}::TEXT,
          ${topic}::TEXT,
          ${JSON.stringify(embedding)}::VECTOR(1536),
          ${vectorWeight}::DOUBLE PRECISION,
          ${keywordWeight}::DOUBLE PRECISION,
          ${limit}::INTEGER
        )
      `,
    );

    rows = result.rows as unknown as DocumentationRow[];
  } else {
    // ✅ SIMPLE CASE: Use Drizzle ORM for type-safe, straightforward query
    const drizzleRows = await db
      .select({
        vector_id: embeddings.vectorId,
        content: embeddings.content,
        content_type: embeddings.contentType,
        metadata: embeddings.metadata,
      })
      .from(embeddings)
      .where(eq(embeddings.libraryId, libraryId));

    // Transform Drizzle result to match interface
    rows = drizzleRows.map((row) => ({
      ...row,
      metadata: row.metadata as Record<string, unknown> | null,
    }));
  }

  if (rows.length === 0) {
    return 'No documentation found for this library.';
  }

  // 📄 Format results for display
  const formattedResults = rows.map((row) => {
    return String(row.content).trim(); // 'original_text' is aliased from 'content' in the query
  });

  return formattedResults.join('\n\n--------------------------------\n\n');
}

/**
 * 📊 ANALYTICS - Get search system performance metrics
 * Uses stored procedure for consistent analytics across the system
 */
export async function getSearchAnalytics(): Promise<{
  totalLibraries: number;
  librariesWithEmbeddings: number;
  librariesWithFts: number;
  avgEmbeddingSimilarity: number;
  searchCoveragePercent: number;
}> {
  const result = await db.execute(sql`SELECT * FROM get_search_analytics()`);

  const row = result.rows[0] as unknown as SearchAnalyticsRow;

  return {
    totalLibraries: row.total_libraries,
    librariesWithEmbeddings: row.libraries_with_embeddings,
    librariesWithFts: row.libraries_with_fts,
    avgEmbeddingSimilarity: parseFloat(row.avg_embedding_similarity.toString()),
    searchCoveragePercent: parseFloat(row.search_coverage_percent.toString()),
  };
}
