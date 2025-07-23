import { PlaywrightCrawler, Configuration } from 'crawlee';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs } from '../jobs/service';
import { sendEvent } from '../events';
import { EmbeddingJobPayload } from '../jobs/jobService';
import { getScopeGlob } from './utils';

export async function crawlDocumentation(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { startUrl } = source;

  const scopeGlob = getScopeGlob(startUrl);

  const crawlerConfig = new Configuration({
    persistStorage: false,
  });

  const crawler = new PlaywrightCrawler(
    {
      maxRequestsPerCrawl: 1000,
      maxConcurrency: 1,
      async requestHandler({ request, enqueueLinks, log }) {
        log.info(`[Job ${jobId}] Discovering URL: ${request.url}`);
        sendEvent(jobId, {
          type: 'progress',
          message: `Discovering documentation page: ${request.url}`,
        });

        // Phase 1: Just discover URLs - NO content extraction
        // We'll fetch fresh content during processing phase

        // Create a minimal job entry with just the URL
        const job: EmbeddingJobPayload = {
          jobId,
          libraryId,
          libraryName: source.name,
          libraryDescription,
          sourceUrl: request.url,
          rawSnippets: [], // Empty - will be populated during processing
          contextMarkdown: undefined, // No markdown stored anymore
          scrapeType: 'documentation',
          customEnrichmentPrompt: source.config.customEnrichmentPrompt,
        };

        // Enqueue the URL for later processing
        await enqueueEmbeddingJobs([job]);
        log.info(`Enqueued URL for later processing: ${request.url}`);

        // Continue crawling to discover more URLs
        await enqueueLinks({
          selector: 'a',
          globs: [scopeGlob],
          strategy: 'same-hostname',
        });
      },
      failedRequestHandler({ request, log }, error) {
        log.error(`[Job ${jobId}] Failed to discover URL ${request.url}`, {
          error,
        });
        sendEvent(jobId, {
          type: 'progress',
          message: `Failed to discover: ${request.url}. Reason: ${error.message}`,
        });
      },
    },
    crawlerConfig,
  );

  console.log(
    `[Job ${jobId}] Starting URL discovery for ${libraryId} at ${startUrl}...`,
  );
  await crawler.run([startUrl]);
  console.log(
    `[Job ${jobId}] URL discovery for ${libraryId} finished successfully.`,
  );
}
