#!/usr/bin/env node
import 'dotenv/config';
import { jobService } from '../src/lib/jobs/jobService';
import pool from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  npm run trigger-processing <jobId>     # Process specific crawl batch
  npm run trigger-processing --all       # Process all pending jobs
  npm run trigger-processing --library <libraryId>  # Process latest jobs for library

Examples:
  npm run trigger-processing abc-123-def-456
  npm run trigger-processing --all
  npm run trigger-processing --library react-docs
`);
    process.exit(1);
  }

  try {
    if (args[0] === '--all') {
      console.log('🚀 Starting processing for all pending jobs...');
      await jobService.processQueue();
    } else if (args[0] === '--library' && args[1]) {
      const libraryId = args[1];
      console.log(`🔍 Finding latest job for library: ${libraryId}`);

      const { jobId } = await jobService.getLatestJobForLibrary(libraryId);
      if (!jobId) {
        console.log(`❌ No jobs found for library: ${libraryId}`);
        process.exit(1);
      }

      console.log(
        `🚀 Processing jobs for library ${libraryId} (jobId: ${jobId})`,
      );
      await jobService.processQueue(jobId);
    } else {
      const jobId = args[0];
      console.log(`🚀 Starting processing for jobId: ${jobId}`);

      // Check if job exists
      const status = await jobService.getCrawlJobStatus(jobId);
      if (status.summary.total === 0) {
        console.log(`❌ No jobs found for jobId: ${jobId}`);
        process.exit(1);
      }

      console.log(
        `📊 Found ${status.summary.total} jobs (${status.summary.pending} pending)`,
      );
      await jobService.processQueue(jobId);
    }

    console.log('✅ Processing completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
