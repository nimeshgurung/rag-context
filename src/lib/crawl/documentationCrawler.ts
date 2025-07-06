import { PlaywrightCrawler } from 'crawlee';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { MarkdownTextSplitter } from 'langchain/text_splitter';
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

  const finalPath = path === '/' ? '' : path;
  return `${urlObject.origin}${finalPath}/**`;
}

export async function crawlDocumentation(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { startUrl, config } = source;
  const { maxDepth = 5 } = config;

  const scopeGlob = getScopeGlob(startUrl);

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxDepth,
    maxConcurrency: 1,
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(`[Job ${jobId}] Processing documentation: ${request.url}`);
      sendEvent(jobId, {
        type: 'progress',
        message: `Crawling documentation: ${request.url}`,
      });

      const html = await page.content();
      const dom = new JSDOM(html, { url: request.url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article || !article.content) {
        log.warning(`No readable content found on ${request.url}. Skipping.`);
        return;
      }

      const markdown = turndownService.turndown(article.content);

      const splitter = new MarkdownTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
      });

      const chunks = await splitter.splitText(markdown);

      const job: EmbeddingJobPayload = {
        jobId,
        libraryId,
        libraryName: source.name,
        libraryDescription,
        sourceUrl: request.url,
        rawSnippets: chunks.filter((chunk) => chunk?.trim() !== ''),
        contextMarkdown: '', // No separate context for documentation
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
    `[Job ${jobId}] Starting documentation crawl for ${libraryId} at ${startUrl}...`,
  );
  await crawler.run([startUrl]);
  console.log(
    `[Job ${jobId}] Documentation crawl for ${libraryId} finished successfully.`,
  );
}
