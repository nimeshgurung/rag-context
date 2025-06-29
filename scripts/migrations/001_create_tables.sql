-- Migration: 001_create_tables.sql
-- Description: Creates the libraries and slop_embeddings tables with a foreign key relationship.

-- Step 1: Ensure the vector extension is available.
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the 'libraries' table to store unique library information.
CREATE TABLE IF NOT EXISTS libraries (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

-- Step 3: Create the 'slop_embeddings' table with a foreign key to 'libraries'.
CREATE TABLE IF NOT EXISTS slop_embeddings (
  vector_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  original_text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  CONSTRAINT fk_library
    FOREIGN KEY(library_id)
    REFERENCES libraries(id)
    ON DELETE CASCADE
);

-- Step 4: Add indexes for performance.
CREATE INDEX IF NOT EXISTS idx_slop_library_id ON slop_embeddings (library_id);
CREATE INDEX IF NOT EXISTS idx_slop_embedding ON slop_embeddings USING hnsw (embedding vector_cosine_ops);