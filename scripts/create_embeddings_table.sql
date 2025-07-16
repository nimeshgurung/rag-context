-- Create the 'embeddings' table with proper structure
CREATE TABLE IF NOT EXISTS embeddings (
  vector_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  original_text TEXT NOT NULL,
  source_url TEXT,
  embedding VECTOR(1536),
  metadata JSONB,
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', original_text)) STORED,
  CONSTRAINT fk_library
    FOREIGN KEY(library_id)
    REFERENCES libraries(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS embeddings_fts_idx ON embeddings USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_embeddings_library_id ON embeddings (library_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_embedding ON embeddings USING hnsw (embedding vector_cosine_ops);