import { PlaywrightCrawler, Configuration } from 'crawlee';
import { enqueueEmbeddingJobs } from '../jobs/service';
import { sendEvent } from '../events';
import { EmbeddingJobPayload } from '../jobs/jobService';
import { buildScopeGlobs, type CrawlOptions } from './utils';

/**
 * Crawls a traditional multi-page documentation site
 */
export async function crawlUrl(options: CrawlOptions) {
  const { jobId, source, libraryId, libraryDescription } = options;
  const { startUrl } = source;

  const crawlerConfig = new Configuration({
    persistStorage: false,
  });

  // Build scope globs for traditional crawling
  const scopeGlobs = buildScopeGlobs(startUrl);

  const crawler = new PlaywrightCrawler(
    {
      maxRequestsPerCrawl: 1000, // Default crawl limit
      maxConcurrency: 1, // Documentation scraping uses single concurrency

      async requestHandler({ request, enqueueLinks, log }) {
        log.info(`[Job ${jobId}] Discovering URL: ${request.url}`);

        sendEvent(jobId, {
          type: 'progress',
          message: `Discovering documentation page: ${request.url}`,
        });

        // Create job for this URL
        const job: EmbeddingJobPayload = {
          jobId,
          libraryId,
          libraryName: source.name,
          libraryDescription,
          sourceUrl: request.url,
          customEnrichmentPrompt: source.config.customEnrichmentPrompt,
        };

        await enqueueEmbeddingJobs([job]);
        log.info(`Enqueued URL for processing: ${request.url}`);

        // Continue traditional crawling
        await enqueueLinks({
          selector: 'a',
          globs: scopeGlobs,
          strategy: 'same-hostname',
        });
      },

      failedRequestHandler({ request, log }, error) {
        log.error(
          `Failed to discover: ${request.url}. Error: ${error.message}`,
        );
        sendEvent(jobId, {
          type: 'warning',
          message: `Failed to discover: ${request.url}. Reason: ${error.message}`,
        });
      },
    },
    crawlerConfig,
  );

  console.log(
    `[Job ${jobId}] Starting traditional crawl for ${libraryId} at ${startUrl}...`,
  );
  await crawler.run([startUrl]);
  console.log(
    `[Job ${jobId}] Traditional crawl for ${libraryId} finished successfully.`,
  );
}
