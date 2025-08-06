import { WebScrapeSource } from '../types';
import { detectHashBasedRouting, type CrawlOptions } from './utils';
import { crawlHash } from './hashCrawler';
import { crawlUrl } from './urlCrawler';

/**
 * Main entry point for crawling documentation sources
 * Automatically detects and uses the appropriate crawling strategy
 */
export async function crawlSource(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const options: CrawlOptions = {
    jobId,
    source,
    libraryId,
    libraryDescription,
  };

  // Check if we should use hash-based crawling
  if (detectHashBasedRouting(source.startUrl)) {
    console.log(
      `[Job ${jobId}] Detected hash-based routing, using hash-aware crawler`,
    );
    await crawlHash(options);
  } else {
    console.log(`[Job ${jobId}] Using traditional crawler for multi-page site`);
    await crawlUrl(options);
  }
}
