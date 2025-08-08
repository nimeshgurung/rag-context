-- Custom SQL migration file, put your code below! --

-- Drop the problematic indexes that can't handle large markdown content
-- These indexes fail when trying to index large text content (> 2704 bytes)
DROP INDEX IF EXISTS "idx_embedding_jobs_source";
DROP INDEX IF EXISTS "idx_embedding_jobs_library_source";

-- Also drop old indexes that might still exist from previous schema
DROP INDEX IF EXISTS "idx_embedding_jobs_source_url";

-- Ensure origin_url index exists (for shorter URLs)
CREATE INDEX IF NOT EXISTS "idx_embedding_jobs_origin_url" ON "embedding_jobs" USING btree ("origin_url");

-- Optional: Create a hash-based index for source lookups
-- This allows efficient searching by source content using MD5 hash
-- Uncomment if you need to search by source content
-- CREATE INDEX IF NOT EXISTS "idx_embedding_jobs_source_hash" ON "embedding_jobs" USING btree (MD5("source"));