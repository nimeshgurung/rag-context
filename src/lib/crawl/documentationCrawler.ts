import { PlaywrightCrawler, Configuration } from 'crawlee';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { MarkdownHeaderTextSplitter } from './MarkdownHeaderTextSplitter';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs } from '../jobs/service';
import { sendEvent } from '../events';
import { EmbeddingJobPayload } from '../jobs/jobService';
import { getScopeGlob } from './utils';

const turndownService = new TurndownService();

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
          ],
          {
            returnEachLine: true,
            stripHeaders: false,
          },
        );
        const chunks = splitter.splitText(markdown);

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
    `[Job ${jobId}] Starting documentation crawl for ${libraryId} at ${startUrl}...`,
  );
  await crawler.run([startUrl]);
  console.log(
    `[Job ${jobId}] Documentation crawl for ${libraryId} finished successfully.`,
  );
}
