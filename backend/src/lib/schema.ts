import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  index,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Libraries table - stores library metadata with embeddings for search
export const libraries = pgTable(
  'libraries',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }), // OpenAI text-embedding-3-small
  },
  (table) => [
    // GIN index for full-text search - directly on tsvector function
    index('libraries_fts_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.name} || ' ' || ${table.description})`,
    ),
    // HNSW index for vector similarity search
    index('idx_libraries_embedding').using(
      'hnsw',
      sql`${table.embedding} vector_cosine_ops`,
    ),
  ],
);

// Embeddings table - stores processed content chunks with vector embeddings
export const embeddings = pgTable(
  'embeddings',
  {
    vectorId: text('vector_id').primaryKey(),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    jobId: integer('job_id').references(() => embeddingJobs.id, {
      onDelete: 'cascade',
    }),
    contentType: text('content_type').notNull(),
    content: text('content').notNull(), // Simplified: stores the full content with title/description embedded
    sourceUrl: text('source_url'),
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: jsonb('metadata'), // Can store extracted title/description if needed
  },
  (table) => [
    // GIN index for full-text search - directly on tsvector function
    index('embeddings_fts_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.content})`,
    ),
    // Index for filtering by library
    index('idx_embeddings_library_id').on(table.libraryId),
    // Composite index for efficient deletion by library and source URL
    index('idx_embeddings_library_source').on(table.libraryId, table.sourceUrl),
    // Index for job_id foreign key
    index('idx_embeddings_job_id').on(table.jobId),
    // HNSW index for vector similarity search
    index('idx_embeddings_embedding').using(
      'hnsw',
      sql`${table.embedding} vector_cosine_ops`,
    ),
  ],
);

// Embedding jobs table - manages the two-phase processing queue
export const embeddingJobs = pgTable(
  'embedding_jobs',
  {
    id: serial('id').primaryKey(),
    jobId: varchar('job_id').notNull(), // UUID for grouping related jobs
    libraryId: text('library_id').notNull(),
    // Simplified source model
    source: text('source').notNull(), // For 'web-scrape': URL to fetch; For 'gitlab-repo': markdown content; For 'api-spec': spec content
    sourceType: varchar('source_type', { length: 20 }).notNull(), // 'web-scrape' | 'gitlab-repo' | 'api-spec'
    originUrl: text('origin_url'), // Canonical trace URL (e.g., gitlab://... for GitLab repos)
    additionalInstructions: text('additional_instructions'), // Additional AI instructions
    preExecutionSteps: text('pre_execution_steps'), // JavaScript code to execute before scraping
    status: varchar('status', { length: 20 }).default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    // Index for querying pending jobs
    index('idx_embedding_jobs_status').on(table.status),
    // Index for querying jobs by batch ID
    index('idx_embedding_jobs_job_id').on(table.jobId),
    // Index for querying jobs by library
    index('idx_embedding_jobs_library_id').on(table.libraryId),
    // Index for origin URL lookups (short URLs)
    index('idx_embedding_jobs_origin_url').on(table.originUrl),
    // Note: We don't index the 'source' column directly as it can contain large markdown content
    // For source lookups, we use a hash-based index created in the migration
  ],
);

// Export type definitions for use throughout the application
export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;

export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

export type EmbeddingJob = typeof embeddingJobs.$inferSelect;
export type NewEmbeddingJob = typeof embeddingJobs.$inferInsert;
