import { PlaywrightCrawler, Configuration } from 'crawlee';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs } from '../jobs/service';
import { sendEvent } from '../events';
import { getScopeGlob } from './utils';

const crawlerConfig = new Configuration({
  persistStorage: false,
});

export async function crawlCode(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { startUrl } = source;

  const scopeGlob = getScopeGlob(startUrl);

  const crawler = new PlaywrightCrawler(
    {
      maxRequestsPerCrawl: 100,
      maxConcurrency: 5,
      async requestHandler({ request, enqueueLinks, log }) {
        log.info(`[Job ${jobId}] Discovering URL: ${request.url}`);
        sendEvent(jobId, {
          type: 'progress',
          message: `Discovering code page: ${request.url}`,
        });

        // Phase 1: Just discover URLs - NO content extraction
        // We'll fetch fresh content and extract code during processing phase

        // Create a minimal job entry with just the URL
        const job = {
          jobId,
          libraryId,
          libraryName: source.name,
          libraryDescription,
          sourceUrl: request.url,
          rawSnippets: [], // Empty - will be populated during processing
          contextMarkdown: undefined, // No markdown stored anymore
          scrapeType: 'code' as const,
          customEnrichmentPrompt: source.config.customEnrichmentPrompt,
        };

        // Always enqueue the URL for later processing
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
