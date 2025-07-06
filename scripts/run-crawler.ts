import { startCrawl } from '../src/lib/crawl/worker';
import pool from '../src/lib/db';

async function run() {
  try {
    await startCrawl();
  } catch (error) {
    console.error('An error occurred during the crawl:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('Crawl process finished.');
  }
}

run();
