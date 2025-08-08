-- Drop the problematic indexes that can't handle large markdown content
DROP INDEX IF EXISTS "idx_embedding_jobs_source";
DROP INDEX IF EXISTS "idx_embedding_jobs_library_source";

-- These indexes might have been renamed, so drop them too if they exist
DROP INDEX IF EXISTS "idx_embedding_jobs_source_url";

-- Create the origin_url index if it doesn't exist
CREATE INDEX IF NOT EXISTS "idx_embedding_jobs_origin_url" ON "embedding_jobs" USING btree ("origin_url");
