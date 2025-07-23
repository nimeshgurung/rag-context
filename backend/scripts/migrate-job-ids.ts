import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function migrateJobIds() {
  console.log('Starting migration to populate job_id in embeddings table...');

  try {
    // Update embeddings with job_id from the most recent completed job
    // that matches the library_id and source_url
    const result = await db.execute(sql`
      UPDATE embeddings e
      SET job_id = (
        SELECT ej.id
        FROM embedding_jobs ej
        WHERE ej.library_id = e.library_id
        AND ej.source_url = e.source_url
        AND ej.status = 'completed'
        ORDER BY ej.processed_at DESC
        LIMIT 1
      )
      WHERE e.job_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM embedding_jobs ej2
        WHERE ej2.library_id = e.library_id
        AND ej2.source_url = e.source_url
      )
    `);

    const rowCount = result.rowCount || 0;
    console.log(`Updated ${rowCount} embeddings with their corresponding job_id`);

    // Log any embeddings that couldn't be matched
    const orphanedEmbeddings = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM embeddings
      WHERE job_id IS NULL
    `);

    const orphanCount = orphanedEmbeddings.rows[0]?.count || 0;
    if (orphanCount > 0) {
      console.log(`Warning: ${orphanCount} embeddings have no matching job (likely from API spec uploads)`);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateJobIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });