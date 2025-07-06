import { PlaywrightCrawler } from 'crawlee';
import TurndownService from 'turndown';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs, EmbeddingJobPayload } from '../jobs/storage';
import { sendEvent } from '../events';
import { crawlDocumentation } from './documentationCrawler';

const turndownService = new TurndownService();

function getScopeGlob(url: string): string {
  const urlObject = new URL(url);

  let path;
  if (urlObject.hash && urlObject.hash.length > 1) {
    let hashPath = urlObject.hash.substring(1);
    if (!hashPath.startsWith('/')) {
      hashPath = `/${hashPath}`;
    }
    path = hashPath;
  } else {
    path = urlObject.pathname;
  }

  // If the path is just '/', we don't want to add a trailing '/**'
  // because it would match everything. Instead, we match the domain.
  // For other paths, we append '/**' to scope to that path.
  const finalPath = path === '/' ? '' : path;
  return `${urlObject.origin}${finalPath}/**`;
}

async function crawlCode(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { startUrl, config } = source;
  const {
    contentSelector,
    codeSelector,
    preExecutionSteps,
    maxDepth = 5,
  } = config;

  const scopeGlob = getScopeGlob(startUrl);

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxDepth,
    maxConcurrency: 1,
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(`[Job ${jobId}] Processing: ${request.url}`);
      sendEvent(jobId, {
        type: 'progress',
        message: `Crawling: ${request.url}`,
      });

      // Execute pre-execution steps if provided
      if (preExecutionSteps && preExecutionSteps.trim()) {
        try {
          log.info(
            `[Job ${jobId}] Executing pre-execution steps for: ${request.url}`,
          );
          sendEvent(jobId, {
            type: 'progress',
            message: `Executing pre-steps for: ${request.url}`,
          });

          // Execute the pre-execution steps as JavaScript code
          await page.evaluate(preExecutionSteps);

          // Wait a bit for any dynamic content to load
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

      const mainContentHTML = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerHTML : document.body.innerHTML;
      }, contentSelector || 'main, article, .main-content, #main-content');

      if (!mainContentHTML) {
        log.warning(`No main content found on ${request.url}. Skipping.`);
        return;
      }

      const contextMarkdown = turndownService.turndown(mainContentHTML);

      // Use codeSelector if provided, otherwise default to 'pre > code'
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
        // Still create a job so we can track the page was crawled
      }

      const job: EmbeddingJobPayload = {
        jobId,
        libraryId,
        libraryName: source.name,
        libraryDescription,
        sourceUrl: request.url,
        rawSnippets: rawCodeSnippets.filter(
          (snippet) => snippet?.trim() !== '',
        ),
        contextMarkdown,
      };

      if (job.rawSnippets.length > 0) {
        await enqueueEmbeddingJobs([job]);
      } else {
        log.info(`No snippets to enqueue for ${request.url}.`);
      }

      // Use default link selector since we removed linkSelector
      await enqueueLinks({
        selector: 'a',
        globs: [scopeGlob],
        strategy: 'same-hostname',
      });
    },
    failedRequestHandler({ request, log }) {
      log.error(
        `[Job ${jobId}] Request ${request.url} failed and will not be retried.`,
      );
      sendEvent(jobId, {
        type: 'progress',
        message: `Failed to crawl: ${request.url}`,
      });
    },
  });

  console.log(
    `[Job ${jobId}] Starting crawl for ${libraryId} at ${startUrl}...`,
  );
  await crawler.run([startUrl]);
  console.log(`[Job ${jobId}] Crawl for ${libraryId} finished successfully.`);
}

export async function crawlSingleSource(
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
