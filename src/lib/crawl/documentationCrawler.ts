import { PlaywrightCrawler } from 'crawlee';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs, EmbeddingJobPayload } from '../jobs/storage';
import { sendEvent } from '../events';
import { MarkdownHeaderTextSplitter } from '../splitters/markdownHeaderTextSplitter';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

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
  const { startUrl } = source;

  const scopeGlob = getScopeGlob(startUrl);

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 1000,
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

      const splitter = new MarkdownHeaderTextSplitter(
        [
          ['#', 'h1'],
          ['##', 'h2'],
          ['###', 'h3'],
          ['####', 'h4'],
          ['#####', 'h5'],
          ['######', 'h6'],
        ],
        false,
        false,
      );

      const chunks = await splitter.splitText(markdown);

      const job: EmbeddingJobPayload = {
        jobId,
        libraryId,
        libraryName: source.name,
        libraryDescription,
        sourceUrl: request.url,
        rawSnippets: chunks.map((chunk) => chunk.pageContent).filter(Boolean),
        scrapeType: 'documentation',
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
