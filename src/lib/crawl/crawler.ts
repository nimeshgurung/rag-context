import { PlaywrightCrawler } from 'crawlee';
import TurndownService from 'turndown';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs, EmbeddingJobPayload } from '../jobs/storage';
import { sendEvent } from '../events';

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

export async function crawlSingleSource(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { startUrl, config } = source;
  const { contentSelector, linkSelector, maxDepth = 5 } = config;

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

      const mainContentHTML = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerHTML : document.body.innerHTML;
      }, contentSelector || 'main, article, .main-content, #main-content');

      if (!mainContentHTML) {
        log.warning(`No main content found on ${request.url}. Skipping.`);
        return;
      }

      const contextMarkdown = turndownService.turndown(mainContentHTML);

      const rawCodeSnippets = await page.evaluate(() => {
        const snippets: string[] = [];
        document.querySelectorAll('pre > code').forEach((codeElement) => {
          snippets.push((codeElement as HTMLElement).textContent || '');
        });
        return snippets;
      });

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

      await enqueueLinks({
        selector: linkSelector || 'a',
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
