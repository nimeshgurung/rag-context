import { PlaywrightCrawler, Configuration } from 'crawlee';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs } from '../jobs/service';
import { sendEvent } from '../events';
import { getScopeGlob } from './utils';

const turndownService = new TurndownService();

const crawlerConfig = new Configuration({
  persistStorage: false,
});

export async function crawlCode(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { startUrl, config } = source;
  const { codeSelector, preExecutionSteps } = config;

  const scopeGlob = getScopeGlob(startUrl);

  const crawler = new PlaywrightCrawler(
    {
      maxRequestsPerCrawl: 100,
      maxConcurrency: 5,
      async requestHandler({ request, page, enqueueLinks, log }) {
        log.info(`[Job ${jobId}] Processing: ${request.url}`);
        sendEvent(jobId, {
          type: 'progress',
          message: `Crawling: ${request.url}`,
        });

        if (preExecutionSteps && preExecutionSteps.trim()) {
          try {
            log.info(
              `[Job ${jobId}] Executing pre-execution steps for: ${request.url}`,
            );
            sendEvent(jobId, {
              type: 'progress',
              message: `Executing pre-steps for: ${request.url}`,
            });

            await page.evaluate(preExecutionSteps);
            await page.waitForTimeout(1000);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            log.warning(
              `[Job ${jobId}] Pre-execution steps failed for ${request.url}: ${errorMessage}`,
            );
            sendEvent(jobId, {
              type: 'progress',
              message: `Pre-execution steps failed for: ${request.url}`,
            });
          }
        }

        const htmlContent = await page.content();
        const dom = new JSDOM(htmlContent, { url: request.url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article?.content) {
          log.warning(`No main content found on ${request.url}. Skipping.`);
          return;
        }

        const contextMarkdown = turndownService.turndown(article.content);

        const codeSnippetSelector = codeSelector || 'pre > code';
        const rawCodeSnippets = await page.evaluate((selector) => {
          const snippets: string[] = [];
          document.querySelectorAll(selector).forEach((codeElement) => {
            snippets.push((codeElement as HTMLElement).textContent || '');
          });
          return snippets;
        }, codeSnippetSelector);

        if (rawCodeSnippets.length === 0) {
          log.info(`No code snippets found on ${request.url}.`);
        }

        const job = {
          jobId,
          libraryId,
          libraryName: source.name,
          libraryDescription,
          sourceUrl: request.url,
          rawSnippets: rawCodeSnippets.filter(
            (snippet) => snippet?.trim() !== '',
          ),
          contextMarkdown,
          scrapeType: 'code' as const,
          customEnrichmentPrompt: source.config.customEnrichmentPrompt,
        };

        if (job.rawSnippets.length > 0) {
          await enqueueEmbeddingJobs([job]);
        } else {
          log.info(`No content chunks to enqueue for ${request.url}.`);
        }

        await enqueueLinks({
          selector: 'a',
          globs: [scopeGlob],
          strategy: 'same-hostname',
        });
      },
      failedRequestHandler({ request, log }, error) {
        log.error(
          `[Job ${jobId}] Request ${request.url} failed and will not be retried.`,
          { error },
        );
        sendEvent(jobId, {
          type: 'progress',
          message: `Failed to crawl: ${request.url}. Reason: ${error.message}`,
        });
      },
    },
    crawlerConfig,
  );

  console.log(
    `[Job ${jobId}] Starting crawl for ${libraryId} at ${startUrl}...`,
  );
  await crawler.run([startUrl]);
  console.log(`[Job ${jobId}] Crawl for ${libraryId} finished successfully.`);
}
