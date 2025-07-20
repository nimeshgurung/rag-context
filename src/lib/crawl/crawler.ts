import { WebScrapeSource } from '../types';
import { crawlDocumentation } from './documentationCrawler';
import { crawlCode } from './codeCrawler';

export async function crawlSource(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { scrapeType } = source.config;

  if (scrapeType === 'documentation') {
    await crawlDocumentation(jobId, source, libraryId, libraryDescription);
  } else {
    await crawlCode(jobId, source, libraryId, libraryDescription);
  }
}
