import { startCrawl } from '../src/lib/crawler/main';

async function run() {
  try {
    console.log('Starting crawler in test mode (depth: 2)...');
    await startCrawl({ maxDepth: 2 });
    console.log('Test crawl finished successfully.');
  } catch (error) {
    console.error('An error occurred during the test crawl:', error);
    process.exit(1);
  }
}

run();
