import { startCrawl } from '../src/lib/crawl/worker';

async function run() {
  try {
    console.log('Starting crawler in test mode (depth: 2)...');
    await startCrawl({ maxDepth: 2 });
    console.log('Test crawl finished successfully.');
    process.exit(0);
  } catch (error) {
    console.error('An error occurred during the test crawl:', error);
    process.exit(1);
  }
}

run();
