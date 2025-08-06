DROP INDEX "libraries_fts_idx";--> statement-breakpoint
ALTER TABLE "embedding_jobs" ALTER COLUMN "library_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "embedding_jobs" ALTER COLUMN "library_description" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "libraries_fts_idx" ON "libraries" USING gin (to_tsvector('english', "name" || ' ' || "description"));