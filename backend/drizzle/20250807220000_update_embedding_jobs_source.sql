-- Alter embedding_jobs to simplified source model
ALTER TABLE embedding_jobs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE embedding_jobs ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
ALTER TABLE embedding_jobs ADD COLUMN IF NOT EXISTS origin_url TEXT;

-- Backfill source from source_url where present
UPDATE embedding_jobs SET source = source_url WHERE source IS NULL AND source_url IS NOT NULL;

-- For existing rows, assume they are URL-based if we had source_url
UPDATE embedding_jobs SET source_type = 'url' WHERE source_type IS NULL AND source_url IS NOT NULL;

-- Make new columns not null after backfill
ALTER TABLE embedding_jobs ALTER COLUMN source SET NOT NULL;
ALTER TABLE embedding_jobs ALTER COLUMN source_type SET NOT NULL;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_source ON embedding_jobs (source);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_origin_url ON embedding_jobs (origin_url);
-- Recreate composite index to reference the new "source" column instead of dropped "source_url"
DO $$ BEGIN
  DROP INDEX IF EXISTS idx_embedding_jobs_library_source;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE INDEX idx_embedding_jobs_library_source ON embedding_jobs (library_id, source);

-- Drop old index and column if exist
DO $$ BEGIN
  DROP INDEX IF EXISTS idx_embedding_jobs_source_url;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE embedding_jobs DROP COLUMN IF EXISTS source_url;


