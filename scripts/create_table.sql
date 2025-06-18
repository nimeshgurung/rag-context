CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS slop_embeddings (
  vector_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  original_text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_library_id ON slop_embeddings (library_id);

CREATE INDEX IF NOT EXISTS idx_embedding ON slop_embeddings USING hnsw (embedding vector_cosine_ops);