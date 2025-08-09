-- Add token_count column to embeddings table for local token counting
-- This supports the library-level token stats feature for GitLab/WebScrape content

ALTER TABLE "embeddings" ADD COLUMN "token_count" integer DEFAULT 0 NOT NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN "embeddings"."token_count" IS 'Number of tokens in the content field, computed locally using gpt-tokenizer';

-- Create index for efficient aggregation queries
CREATE INDEX "idx_embeddings_token_count" ON "embeddings" ("token_count");

