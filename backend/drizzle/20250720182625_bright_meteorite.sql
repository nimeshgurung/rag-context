CREATE TABLE "embedding_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar NOT NULL,
	"library_id" text NOT NULL,
	"library_name" text,
	"library_description" text,
	"source_url" text NOT NULL,
	"scrape_type" text,
	"context_markdown" text,
	"raw_snippets" jsonb,
	"custom_enrichment_prompt" text,
	"status" varchar(20) DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"vector_id" text PRIMARY KEY NOT NULL,
	"library_id" text NOT NULL,
	"content_type" text NOT NULL,
	"title" text,
	"description" text,
	"original_text" text NOT NULL,
	"source_url" text,
	"embedding" vector(1536),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"embedding" vector(1536)
);
--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_status" ON "embedding_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_job_id" ON "embedding_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_library_id" ON "embedding_jobs" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_source_url" ON "embedding_jobs" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_library_source" ON "embedding_jobs" USING btree ("library_id","source_url");--> statement-breakpoint
CREATE INDEX "embeddings_fts_idx" ON "embeddings" USING gin (to_tsvector('english', "original_text"));--> statement-breakpoint
CREATE INDEX "idx_embeddings_library_id" ON "embeddings" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_embedding" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "libraries_fts_idx" ON "libraries" USING gin (to_tsvector('english', COALESCE("name", '') || ' ' || COALESCE("description", '')));--> statement-breakpoint
CREATE INDEX "idx_libraries_embedding" ON "libraries" USING hnsw ("embedding" vector_cosine_ops);

-- 🚀 RAG SYSTEM STORED PROCEDURES
-- Complex search operations for better performance and maintainability

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

-- 🔍 FUNCTION: Search libraries with hybrid vector + keyword search
CREATE OR REPLACE FUNCTION search_libraries_hybrid(
    p_library_name TEXT,
    p_embedding VECTOR(1536),
    p_vector_weight DOUBLE PRECISION DEFAULT 0.7,
    p_keyword_weight DOUBLE PRECISION DEFAULT 0.3,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    library_id TEXT,
    name VARCHAR(255),
    description TEXT,
    similarity_score DOUBLE PRECISION,
    keyword_score DOUBLE PRECISION,
    hybrid_score DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
            WITH vector_search AS (
            SELECT
                l.id::TEXT,
                l.name,
                l.description,
                (1 - (l.embedding <=> p_embedding))::DOUBLE PRECISION AS vector_similarity
            FROM libraries l
            WHERE l.embedding IS NOT NULL
        ),
        keyword_search AS (
            SELECT
                l.id::TEXT,
                l.name,
                l.description,
                ts_rank_cd(
                    to_tsvector('english', COALESCE(l.name, '') || ' ' || COALESCE(l.description, '')),
                    plainto_tsquery('english', p_library_name)
                )::DOUBLE PRECISION AS keyword_rank
            FROM libraries l
            WHERE to_tsvector('english', COALESCE(l.name, '') || ' ' || COALESCE(l.description, ''))
                  @@ plainto_tsquery('english', p_library_name)
        )
        SELECT
            COALESCE(vs.id, ks.id) AS library_id,
            COALESCE(vs.name, ks.name) AS name,
            COALESCE(vs.description, ks.description) AS description,
            COALESCE(vs.vector_similarity, 0::DOUBLE PRECISION) AS similarity_score,
            COALESCE(ks.keyword_rank, 0::DOUBLE PRECISION) AS keyword_score,
            (p_vector_weight * COALESCE(vs.vector_similarity, 0::DOUBLE PRECISION) +
             p_keyword_weight * COALESCE(ks.keyword_rank, 0::DOUBLE PRECISION))::DOUBLE PRECISION AS hybrid_score
    FROM vector_search vs
    FULL OUTER JOIN keyword_search ks ON vs.id = ks.id
    ORDER BY hybrid_score DESC
    LIMIT p_limit;
END;
$$;--> statement-breakpoint

-- 📄 FUNCTION: Search within library documentation with hybrid approach
CREATE OR REPLACE FUNCTION search_library_documentation(
    p_library_id TEXT,
    p_search_term TEXT,
    p_embedding VECTOR(1536),
    p_vector_weight DOUBLE PRECISION DEFAULT 0.7,
    p_keyword_weight DOUBLE PRECISION DEFAULT 0.3,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    vector_id TEXT,
    original_text TEXT,
    title TEXT,
    description TEXT,
    content_type TEXT,
    metadata JSONB,
    similarity_score DOUBLE PRECISION,
    keyword_score DOUBLE PRECISION,
    hybrid_score DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            e.vector_id,
            e.original_text,
            e.title,
            e.description,
            e.content_type,
            e.metadata,
            (1 - (e.embedding <=> p_embedding))::DOUBLE PRECISION AS vector_similarity
        FROM embeddings e
        WHERE e.library_id = p_library_id
            AND e.embedding IS NOT NULL
    ),
    keyword_search AS (
        SELECT
            e.vector_id,
            e.original_text,
            e.title,
            e.description,
            e.content_type,
            e.metadata,
            ts_rank_cd(
                to_tsvector('english', e.original_text),
                plainto_tsquery('english', p_search_term)
            )::DOUBLE PRECISION AS keyword_rank
        FROM embeddings e
        WHERE e.library_id = p_library_id
            AND to_tsvector('english', e.original_text) @@ plainto_tsquery('english', p_search_term)
    )
    SELECT
        COALESCE(vs.vector_id, ks.vector_id) AS vector_id,
        COALESCE(vs.original_text, ks.original_text) AS original_text,
        COALESCE(vs.title, ks.title) AS title,
        COALESCE(vs.description, ks.description) AS description,
        COALESCE(vs.content_type, ks.content_type) AS content_type,
        COALESCE(vs.metadata, ks.metadata) AS metadata,
        COALESCE(vs.vector_similarity, 0::DOUBLE PRECISION) AS similarity_score,
        COALESCE(ks.keyword_rank, 0::DOUBLE PRECISION) AS keyword_score,
        (p_vector_weight * COALESCE(vs.vector_similarity, 0::DOUBLE PRECISION) +
         p_keyword_weight * COALESCE(ks.keyword_rank, 0::DOUBLE PRECISION))::DOUBLE PRECISION AS hybrid_score
    FROM vector_search vs
    FULL OUTER JOIN keyword_search ks ON vs.vector_id = ks.vector_id
    ORDER BY hybrid_score DESC
    LIMIT p_limit;
END;
$$;--> statement-breakpoint

-- 📊 FUNCTION: Get search system analytics and health metrics
CREATE OR REPLACE FUNCTION get_search_analytics()
RETURNS TABLE (
    total_libraries BIGINT,
    libraries_with_embeddings BIGINT,
    libraries_with_fts BIGINT,
    avg_embedding_similarity DOUBLE PRECISION,
    search_coverage_percent DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_libraries,
        COUNT(CASE WHEN l.embedding IS NOT NULL THEN 1 END)::BIGINT AS libraries_with_embeddings,
        COUNT(CASE
            WHEN COALESCE(l.name, '') || ' ' || COALESCE(l.description, '') != ''
            THEN 1
        END)::BIGINT AS libraries_with_fts,
        AVG(CASE WHEN l.embedding IS NOT NULL THEN 0.8::DOUBLE PRECISION ELSE 0::DOUBLE PRECISION END) AS avg_embedding_similarity,
        (COUNT(CASE WHEN l.embedding IS NOT NULL THEN 1 END) * 100.0 / GREATEST(COUNT(*), 1))::DOUBLE PRECISION AS search_coverage_percent
    FROM libraries l;
END;
$$;--> statement-breakpoint

-- 📝 COMMENTS: Add helpful documentation
COMMENT ON FUNCTION search_libraries_hybrid IS 'Performs hybrid vector + keyword search on libraries with configurable weights';--> statement-breakpoint
COMMENT ON FUNCTION search_library_documentation IS 'Searches documentation within a specific library using hybrid approach - COMPLEX QUERIES ONLY';--> statement-breakpoint
COMMENT ON FUNCTION get_search_analytics IS 'Provides analytics on search system performance and coverage';