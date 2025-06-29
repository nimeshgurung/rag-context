import { PlaywrightCrawler } from 'crawlee';
import TurndownService from 'turndown';
import dedent from 'dedent';
import { EnrichedItem, WebScrapeSource } from '../types';
import { loadConfig } from './config';
import { getEnrichedDataFromLLM } from './enrichment';
import { saveEnrichedData } from './storage';
import pool from '../db';
import { sendEvent } from '../events';

const turndownService = new TurndownService();

export async function crawlSingleSource(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
) {
  const { startUrl, config } = source;
  const { contentSelector, linkSelector, maxDepth } = config;

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxDepth,
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
      }

      const enrichmentPromises = rawCodeSnippets
        .map((rawSnippet) => {
          if (dedent(rawSnippet)) {
            return getEnrichedDataFromLLM(rawSnippet, contextMarkdown);
          }
          return null;
        })
        .filter((p): p is Promise<EnrichedItem> => p !== null);

      const enrichedData = await Promise.all(enrichmentPromises);

      if (enrichedData.length > 0) {
        await saveEnrichedData(
          enrichedData,
          { libraryId, libraryName: source.name, libraryDescription },
          request.url,
        );
      }

      await enqueueLinks({
        selector: linkSelector || 'a',
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

export async function startCrawl({ maxDepth }: { maxDepth?: number } = {}) {
  const config = await loadConfig();
  const webSourcesWithLibInfo = config.libraries.flatMap((lib) =>
    lib.sources
      .filter((source) => source.type === 'web' && source.rootUrl)
      .map((source) => ({
        ...source,
        libraryId: lib.libraryId,
        libraryName: lib.name,
        libraryDescription: lib.description,
      })),
  );

  if (webSourcesWithLibInfo.length === 0) {
    console.error('No web sources found in the configuration.');
    return;
  }

  const startRequests = webSourcesWithLibInfo.map((s) => ({
    url: s.rootUrl as string,
    userData: {
      libraryId: s.libraryId,
      libraryName: s.libraryName,
      libraryDescription: s.libraryDescription,
    },
  }));

  const allGlobs = webSourcesWithLibInfo.flatMap(
    (source) =>
      source.scope?.map((pattern) => {
        const trimmedRoot = source.rootUrl!.endsWith('/')
          ? source.rootUrl!.slice(0, -1)
          : source.rootUrl!;
        const trimmedPattern = pattern.startsWith('/')
          ? pattern.slice(1)
          : pattern;
        return `${trimmedRoot}/${trimmedPattern}`;
      }) || [],
  );

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxDepth ? maxDepth : undefined,
    maxConcurrency: 20,
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(`Processing: ${request.url}`);

      const mainContentHTML = await page.evaluate(() => {
        const mainEl = document.querySelector(
          'main, article, .main-content, #main-content',
        );
        return mainEl ? mainEl.innerHTML : document.body.innerHTML;
      });

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
      }

      const enrichmentPromises = rawCodeSnippets
        .map((rawSnippet) => {
          if (dedent(rawSnippet)) {
            return getEnrichedDataFromLLM(rawSnippet, contextMarkdown);
          }
          return null;
        })
        .filter((p): p is Promise<EnrichedItem> => p !== null);

      const enrichedData = await Promise.all(enrichmentPromises);

      if (enrichedData.length > 0) {
        await saveEnrichedData(
          enrichedData,
          {
            libraryId: request.userData.libraryId,
            libraryName: request.userData.libraryName,
            libraryDescription: request.userData.libraryDescription,
          },
          request.url,
        );
      }

      await enqueueLinks({
        globs: allGlobs,
        strategy: 'same-hostname',
      });
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed and will not be retried.`);
    },
  });

  console.log('Starting the documentation crawl...');
  await crawler.run(startRequests);
  console.log('Crawl finished successfully.');
  await pool.end();
}
