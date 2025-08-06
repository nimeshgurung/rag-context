import { WebScrapeSource } from '../../types';

export interface CrawlOptions {
  jobId: string;
  source: WebScrapeSource;
  libraryId: string;
  libraryName: string;
  libraryDescription: string;
}
