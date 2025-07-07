-- Migration to add custom_enrichment_prompt column to embedding_jobs table
ALTER TABLE embedding_jobs 
ADD COLUMN IF NOT EXISTS custom_enrichment_prompt TEXT;

-- Add comment for documentation
COMMENT ON COLUMN embedding_jobs.custom_enrichment_prompt IS 'Custom instructions to be used during the enrichment process for code snippets';