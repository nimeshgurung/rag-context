-- Migration: Remove UNIQUE constraint on (source_url, library_id) to allow multiple resources per library
-- Date: 2024
-- Purpose: Enable adding multiple resources (URLs/specs) to existing libraries

-- Remove the unique constraint if it exists
ALTER TABLE embedding_jobs 
DROP CONSTRAINT IF EXISTS embedding_jobs_source_url_library_id_key;

-- Add a regular index for performance (if it doesn't already exist)
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_source_library 
ON embedding_jobs(source_url, library_id);

-- Add index on library_id for faster queries (if it doesn't already exist)
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_library_id 
ON embedding_jobs(library_id);

-- Add comment to table explaining the change
COMMENT ON TABLE embedding_jobs IS 'Stores embedding jobs for library resources. Multiple jobs per URL/library are now allowed to support multiple resources per library.';