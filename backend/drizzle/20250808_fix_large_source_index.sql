-- Drop indexes on source column that can't handle large markdown content
DROP INDEX IF EXISTS idx_embedding_jobs_source;
DROP INDEX IF EXISTS idx_embedding_jobs_library_source;

-- Add a hash-based index for source lookups if needed (using MD5 hash)
-- This allows us to still search by source content efficiently
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_source_hash
  ON embedding_jobs (MD5(source));

-- Keep the origin_url index as it contains shorter URLs
-- The other indexes are fine as they're on small columns
