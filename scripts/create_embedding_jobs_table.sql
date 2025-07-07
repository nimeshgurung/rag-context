DROP TABLE IF EXISTS embedding_jobs;
CREATE TABLE embedding_jobs (
    id SERIAL PRIMARY KEY,
    job_id UUID NOT NULL,
    library_id TEXT NOT NULL,
    library_name TEXT,
    library_description TEXT,
    source_url TEXT NOT NULL,
    scrape_type TEXT,
    context_markdown TEXT,
    raw_snippets JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster querying of pending jobs
CREATE INDEX idx_embedding_jobs_status ON embedding_jobs(status);
-- Index for querying jobs by crawl id
CREATE INDEX idx_embedding_jobs_job_id ON embedding_jobs(job_id);
-- Performance indexes for querying by library and source
CREATE INDEX idx_embedding_jobs_library_id ON embedding_jobs(library_id);
CREATE INDEX idx_embedding_jobs_source_url ON embedding_jobs(source_url);
-- Compound index for common queries
CREATE INDEX idx_embedding_jobs_library_source ON embedding_jobs(library_id, source_url);