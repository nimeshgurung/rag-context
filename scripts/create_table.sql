-- Drop existing tables to ensure a clean slate
DROP TABLE IF EXISTS slop_embeddings;
DROP TABLE IF EXISTS libraries;

-- Ensure the vector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the 'libraries' table
CREATE TABLE libraries (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embedding VECTOR(1536), -- Assuming OpenAI text-embedding-3-small
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || coalesce(description, ''))) STORED
);

-- Create the 'slop_embeddings' table
CREATE TABLE slop_embeddings (
  vector_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  original_text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', original_text)) STORED,
  CONSTRAINT fk_library
    FOREIGN KEY(library_id)
    REFERENCES libraries(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX libraries_fts_idx ON libraries USING GIN(fts);
CREATE INDEX slop_embeddings_fts_idx ON slop_embeddings USING GIN(fts);
CREATE INDEX idx_slop_library_id ON slop_embeddings (library_id);
CREATE INDEX idx_slop_embedding ON slop_embeddings USING hnsw (embedding vector_cosine_ops);

-- Add title and description columns if they don't exist
ALTER TABLE slop_embeddings
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;