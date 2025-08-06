ALTER TABLE "embeddings" RENAME COLUMN "original_text" TO "content";--> statement-breakpoint
DROP INDEX "embeddings_fts_idx";--> statement-breakpoint
CREATE INDEX "embeddings_fts_idx" ON "embeddings" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
ALTER TABLE "embeddings" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "embeddings" DROP COLUMN "description";