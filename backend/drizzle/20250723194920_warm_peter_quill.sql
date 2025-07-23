ALTER TABLE "embeddings" ADD COLUMN "job_id" integer;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_job_id_embedding_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."embedding_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_embeddings_job_id" ON "embeddings" USING btree ("job_id");