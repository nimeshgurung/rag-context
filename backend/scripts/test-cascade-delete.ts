import { db } from '../src/lib/db';
import { embeddings, embeddingJobs } from '../src/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { jobService } from '../src/lib/jobs/jobService';

async function testCascadeDelete() {
  console.log('Testing CASCADE delete for job -> embeddings...\n');

  try {
    // Find a completed job that has embeddings with job_id set
    const jobWithEmbeddings = await db.execute(sql`
      SELECT
        ej.id,
        ej.library_id,
        ej.source_url,
        ej.status,
        (SELECT COUNT(*) FROM embeddings e WHERE e.job_id = ej.id) as embedding_count
      FROM embedding_jobs ej
      WHERE ej.status = 'completed'
      AND EXISTS (
        SELECT 1 FROM embeddings e2 WHERE e2.job_id = ej.id
      )
      LIMIT 1
    `);

    if (jobWithEmbeddings.rows.length === 0) {
      console.log('No completed jobs with linked embeddings found.');
      console.log('You may need to run the migration first: npm run migrate:job-ids');
      return;
    }

    const testJob = jobWithEmbeddings.rows[0];
    console.log('Found test job:');
    console.log(`- Job ID: ${testJob.id}`);
    console.log(`- Library ID: ${testJob.library_id}`);
    console.log(`- Source URL: ${testJob.source_url}`);
    console.log(`- Embeddings count: ${testJob.embedding_count}`);

    // Test deletion
    console.log('\nDeleting job...');
    await jobService.deleteJob(testJob.id as number);

    // Verify deletion
    const jobAfter = await db
      .select()
      .from(embeddingJobs)
      .where(eq(embeddingJobs.id, testJob.id as number));

    const embeddingsAfter = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM embeddings
      WHERE job_id = ${testJob.id}
    `);

    console.log(`\nJob exists after deletion: ${jobAfter.length > 0 ? 'Yes' : 'No'}`);
    console.log(`Embeddings with job_id=${testJob.id} after deletion: ${embeddingsAfter.rows[0].count}`);

    if (jobAfter.length === 0 && embeddingsAfter.rows[0].count === '0') {
      console.log('\n✅ Success! CASCADE delete is working correctly.');
    } else {
      console.log('\n❌ Failed! CASCADE delete is not working as expected.');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCascadeDelete()
  .then(() => process.exit(0))
  .catch(console.error);