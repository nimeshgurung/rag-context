import { pgTable, serial, text, varchar, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom vector type for pgvector
export const vector = (name: string, config?: { dimensions?: number }) => {
  return text(name).$type<number[]>();
};

// Libraries table - stores library metadata with embeddings for search
export const libraries = pgTable('libraries', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI text-embedding-3-small
  // Full-text search vector - auto-generated from name + description
  fts: text('fts').$type<string>(),
}, (table) => ({
  // GIN index for full-text search
  ftsIdx: index('libraries_fts_idx').using('gin', table.fts),
  // HNSW index for vector similarity search
  embeddingIdx: index('idx_libraries_embedding').using('hnsw', sql`${table.embedding} vector_cosine_ops`),
}));

// Embeddings table - stores processed content chunks with vector embeddings
export const embeddings = pgTable('embeddings', {
  vectorId: text('vector_id').primaryKey(),
  libraryId: text('library_id').notNull().references(() => libraries.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  title: text('title'),
  description: text('description'),
  originalText: text('original_text').notNull(),
  sourceUrl: text('source_url'),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata'),
  // Full-text search vector - auto-generated from original text
  fts: text('fts').$type<string>(),
}, (table) => ({
  // GIN index for full-text search
  ftsIdx: index('embeddings_fts_idx').using('gin', table.fts),
  // Index for filtering by library
  libraryIdx: index('idx_embeddings_library_id').on(table.libraryId),
  // HNSW index for vector similarity search
  embeddingIdx: index('idx_embeddings_embedding').using('hnsw', sql`${table.embedding} vector_cosine_ops`),
}));

// Embedding jobs table - manages the two-phase processing queue
export const embeddingJobs = pgTable('embedding_jobs', {
  id: serial('id').primaryKey(),
  jobId: varchar('job_id').notNull(), // UUID for grouping related jobs
  libraryId: text('library_id').notNull(),
  libraryName: text('library_name'),
  libraryDescription: text('library_description'),
  sourceUrl: text('source_url').notNull(),
  scrapeType: text('scrape_type'), // 'code' | 'documentation'
  contextMarkdown: text('context_markdown'), // Phase 1: Raw markdown content
  rawSnippets: jsonb('raw_snippets'), // Phase 1: Raw code snippets
  customEnrichmentPrompt: text('custom_enrichment_prompt'), // Custom AI instructions
  status: varchar('status', { length: 20 }).default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  attempts: integer('attempts').default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => ({
  // Index for querying pending jobs
  statusIdx: index('idx_embedding_jobs_status').on(table.status),
  // Index for querying jobs by batch ID
  jobIdIdx: index('idx_embedding_jobs_job_id').on(table.jobId),
  // Index for querying jobs by library
  libraryIdIdx: index('idx_embedding_jobs_library_id').on(table.libraryId),
  // Index for source URL lookups
  sourceUrlIdx: index('idx_embedding_jobs_source_url').on(table.sourceUrl),
  // Compound index for common queries
  librarySourceIdx: index('idx_embedding_jobs_library_source').on(table.libraryId, table.sourceUrl),
}));

// Export type definitions for use throughout the application
export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

export type EmbeddingJob = typeof embeddingJobs.$inferSelect;
export type NewEmbeddingJob = typeof embeddingJobs.$inferInsert;