import { PlaywrightCrawler, Configuration } from 'crawlee';
import { enqueueEmbeddingJobs } from '../jobs/service';
import { sendEvent } from '../events';
import { EmbeddingJobPayload } from '../jobs/jobService';
import { extractHashRoutes, isWithinScope, type CrawlOptions } from './utils';

/**
 * Crawls a hash-based documentation site
 */
export async function crawlHash(options: CrawlOptions) {
  const { jobId, source, libraryId, libraryDescription } = options;
  const { startUrl } = source;

  const processedUrls = new Set<string>();
  const urlsToProcess: string[] = [startUrl];

  const createCrawler = () => {
    const crawlerConfig = new Configuration({
      persistStorage: false,
    });

    return new PlaywrightCrawler(
      {
        maxRequestsPerCrawl: 1, // Process one URL at a time
        maxConcurrency: 1,
        navigationTimeoutSecs: 30,

        async requestHandler({ request, page, log }) {
          const currentUrl = request.url;

          log.info(`[Job ${jobId}] Processing hash route: ${currentUrl}`);

          sendEvent(jobId, {
            type: 'progress',
            message: `Discovering documentation page: ${currentUrl}`,
          });

          // Wait for content to load (SPAs often load content dynamically)
          await page.waitForTimeout(2000);

          // Try to wait for common content selectors
          try {
            await page.waitForSelector(
              'main, article, .content, .docs-content, .documentation',
              {
                timeout: 5000,
              },
            );
          } catch {
            // Content might be loaded differently, continue anyway
          }

          // Extract new hash routes from current page
          const newRoutes = await extractHashRoutes(page, currentUrl, startUrl);

          // Add new routes to processing queue
          for (const route of newRoutes) {
            if (!processedUrls.has(route) && !urlsToProcess.includes(route)) {
              // Double-check scope before adding to queue
              if (isWithinScope(route, startUrl)) {
                urlsToProcess.push(route);
                log.info(`Discovered new hash route: ${route}`);
              } else {
                log.info(`Skipping out-of-scope route: ${route}`);
              }
            }
          }

          // Create job for this URL
          const job: EmbeddingJobPayload = {
            jobId,
            libraryId,
            libraryName: source.name,
            libraryDescription,
            sourceUrl: currentUrl,
            customEnrichmentPrompt: source.config.customEnrichmentPrompt,
            preExecutionSteps: source.config.preExecutionSteps,
          };

          await enqueueEmbeddingJobs([job]);
          log.info(`Enqueued hash route for processing: ${currentUrl}`);
        },

        failedRequestHandler({ request, log }, error) {
          log.error(
            `Failed to process hash route: ${request.url}. Error: ${error.message}`,
          );
          sendEvent(jobId, {
            type: 'warning',
            message: `Failed to discover: ${request.url}. Reason: ${error.message}`,
          });
        },
      },
      crawlerConfig,
    );
  };

  console.log(
    `[Job ${jobId}] Starting hash-based crawl for ${libraryId} at ${startUrl}...`,
  );

  // Process URLs one at a time with fresh crawler instances
  while (urlsToProcess.length > 0) {
    const urlToProcess = urlsToProcess.shift()!;

    // Skip if already processed (double-check)
    if (processedUrls.has(urlToProcess)) {
      continue;
    }

    processedUrls.add(urlToProcess);

    try {
      const crawler = createCrawler();
      await crawler.run([urlToProcess]);
    } catch (error) {
      console.error(`[Job ${jobId}] Error processing ${urlToProcess}:`, error);
      sendEvent(jobId, {
        type: 'warning',
        message: `Failed to process: ${urlToProcess}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  console.log(
    `[Job ${jobId}] Hash-based crawl for ${libraryId} finished. Processed ${processedUrls.size} routes.`,
  );
}
