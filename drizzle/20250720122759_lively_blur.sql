-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
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
	"metadata" jsonb,
	"fts" tsvector GENERATED ALWAYS AS (to_tsvector('english', original_text)) STORED
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"embedding" vector(1536),
	"fts" tsvector GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || coalesce(description, ''))) STORED
);
--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_status" ON "embedding_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_job_id" ON "embedding_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_library_id" ON "embedding_jobs" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_source_url" ON "embedding_jobs" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "idx_embedding_jobs_library_source" ON "embedding_jobs" USING btree ("library_id","source_url");--> statement-breakpoint
CREATE INDEX "embeddings_fts_idx" ON "embeddings" USING gin ("fts");--> statement-breakpoint
CREATE INDEX "idx_embeddings_library_id" ON "embeddings" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_embedding" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "libraries_fts_idx" ON "libraries" USING gin ("fts");--> statement-breakpoint
CREATE INDEX "idx_libraries_embedding" ON "libraries" USING hnsw ("embedding" vector_cosine_ops);