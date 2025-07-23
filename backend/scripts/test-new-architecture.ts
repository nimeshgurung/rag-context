import 'dotenv/config';
import { fetchMarkdownForUrl } from '../src/lib/crawl/contentFetcher';
import { jobService } from '../src/lib/jobs/jobService';
import { db } from '../src/lib/db';
import { embeddingJobs } from '../src/lib/schema';
import { eq } from 'drizzle-orm';

async function testContentFetcher() {
  console.log('=== Testing Content Fetcher ===');
  const testUrl = 'https://example.com';

  try {
    const result = await fetchMarkdownForUrl(testUrl);
    console.log('Fetch result:', {
      success: result.success,
      contentLength: result.markdown?.length || 0,
      error: result.error,
    });
  } catch (error) {
    console.error('Content fetcher error:', error);
  }
}

async function testJobProcessing() {
  console.log('\n=== Testing Job Processing ===');

  // Get a pending job from the database
  const pendingJobs = await db
    .select()
    .from(embeddingJobs)
    .where(eq(embeddingJobs.status, 'pending'))
    .limit(1);

  if (pendingJobs.length === 0) {
    console.log('No pending jobs found. Please add a library first.');
    return;
  }

  const job = pendingJobs[0];
  console.log('Processing job:', {
    id: job.id,
    url: job.sourceUrl,
    scrapeType: job.scrapeType,
  });

  try {
    const result = await jobService.processSingleJob(job.id);
    console.log('Job processing result:', result);
  } catch (error) {
    console.error('Job processing error:', error);
  }
}

async function checkJobStatus() {
  console.log('\n=== Checking Job Status ===');

  const stats = await db
    .select({
      status: embeddingJobs.status,
      count: db.$count(embeddingJobs.id),
    })
    .from(embeddingJobs)
    .groupBy(embeddingJobs.status);

  console.log('Job statistics:');
  stats.forEach(stat => {
    console.log(`  ${stat.status}: ${stat.count}`);
  });

  // Check for fetch vs processing errors
  const failedJobs = await db
    .select({
      id: embeddingJobs.id,
      url: embeddingJobs.sourceUrl,
      error: embeddingJobs.errorMessage,
    })
    .from(embeddingJobs)
    .where(eq(embeddingJobs.status, 'failed'))
    .limit(5);

  if (failedJobs.length > 0) {
    console.log('\nFailed jobs:');
    failedJobs.forEach(job => {
      const errorType = job.error?.includes('[fetch]') ? 'Fetch' : 'Processing';
      console.log(`  ID ${job.id} (${errorType}): ${job.url}`);
      console.log(`    Error: ${job.error}`);
    });
  }
}

async function main() {
  console.log('Testing New Architecture\n');

  await testContentFetcher();
  await testJobProcessing();
  await checkJobStatus();

  console.log('\n✅ Test complete');
  process.exit(0);
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});