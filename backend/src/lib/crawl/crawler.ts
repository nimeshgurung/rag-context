import { WebScrapeSource } from '../types';
import { crawlWithHashSupport } from './hashAwareCrawler';

export async function crawlSource(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { scrapeType } = source.config;

  await crawlWithHashSupport(
    jobId,
    source,
    libraryId,
    libraryDescription,
    scrapeType,
  );
}
