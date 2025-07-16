-- Create the 'libraries' table with proper structure
CREATE TABLE libraries (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embedding VECTOR(1536), -- Assuming OpenAI text-embedding-3-small
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || coalesce(description, ''))) STORED
);

-- Create indexes for performance
CREATE INDEX libraries_fts_idx ON libraries USING GIN(fts);
CREATE INDEX idx_libraries_embedding ON libraries USING hnsw (embedding vector_cosine_ops);