import { PlaywrightCrawler, Configuration } from 'crawlee';
import { Page } from 'playwright';
import { WebScrapeSource } from '../types';
import { enqueueEmbeddingJobs } from '../jobs/service';
import { sendEvent } from '../events';
import { EmbeddingJobPayload } from '../jobs/jobService';
import {
  detectHashBasedRouting,
  normalizeHashRoute,
  buildHashUrl,
  isSameHashRoute,
} from './hashDetection';

interface CrawlOptions {
  jobId: string;
  source: WebScrapeSource;
  libraryId: string;
  libraryDescription: string;
  scrapeType: 'documentation' | 'code';
}

/**
 * Validates if a URL is within the allowed scope
 */
function isWithinScope(
  url: string,
  startUrl: string,
  allowedPaths?: string[],
  excludePaths?: string[],
): boolean {
  try {
    const urlObj = new URL(url);
    const startUrlObj = new URL(startUrl);

    // Must be same origin (protocol + hostname + port)
    if (urlObj.origin !== startUrlObj.origin) {
      return false;
    }

    const urlPath = urlObj.pathname;

    // Check excluded paths first
    if (excludePaths && excludePaths.length > 0) {
      for (const excludePath of excludePaths) {
        if (urlPath.startsWith(excludePath) || urlPath === excludePath) {
          return false;
        }
      }
    }

    // If specific paths are allowed, check against them
    if (allowedPaths && allowedPaths.length > 0) {
      return allowedPaths.some(
        (allowedPath) =>
          urlPath.startsWith(allowedPath) || urlPath === allowedPath,
      );
    }

    // For hash-based URLs, check if the base path matches
    if (startUrlObj.pathname !== '/' && startUrlObj.pathname !== '') {
      // If start URL has a specific path, stay within it
      const basePath = startUrlObj.pathname.replace(/\/$/, '');
      const urlPathNormalized = urlPath.replace(/\/$/, '');
      return (
        urlPathNormalized.startsWith(basePath) || urlPathNormalized === basePath
      );
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts all unique hash routes from a page
 */
async function extractHashRoutes(
  page: Page,
  baseUrl: string,
  startUrl: string,
  allowedPaths?: string[],
  excludePaths?: string[],
): Promise<string[]> {
  const routes = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const hashRoutes = new Set<string>();

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      // Skip external URLs
      if (href.startsWith('http://') || href.startsWith('https://')) {
        // Only process if it's a hash URL from same domain
        try {
          const hrefUrl = new URL(href);
          const currentUrl = new URL(window.location.href);
          if (hrefUrl.origin !== currentUrl.origin) {
            return; // Skip external domains
          }
          // If it has a hash route, extract it
          if (
            hrefUrl.hash &&
            (hrefUrl.hash.startsWith('#/') || hrefUrl.hash.startsWith('#!/'))
          ) {
            hashRoutes.add(hrefUrl.hash);
          }
        } catch {
          return;
        }
      }
      // Handle hash routes (various formats)
      else if (href.startsWith('#/') || href.startsWith('#!/')) {
        hashRoutes.add(href);
      }
      // Handle relative paths that might be hash routes
      else if (href.startsWith('/') && !href.startsWith('//')) {
        // These might be meant as hash routes in an SPA
        hashRoutes.add(`#${href}`);
      }
      // Handle plain hash links that look like routes
      else if (
        href.startsWith('#') &&
        href.length > 1 &&
        !href.startsWith('#!')
      ) {
        // Convert to hash route format if it looks like a path
        if (href.includes('/') || href.match(/^#[a-zA-Z]/)) {
          hashRoutes.add(
            href.startsWith('#/') ? href : `#/${href.substring(1)}`,
          );
        }
      }
    });

    return Array.from(hashRoutes);
  });

  // Convert to full URLs and normalize, filtering by scope
  const uniqueUrls = new Set<string>();
  const baseUrlObj = new URL(baseUrl);

  for (const route of routes) {
    const normalizedRoute = normalizeHashRoute(route.replace(/^#!?/, ''));
    const fullUrl = buildHashUrl(
      baseUrlObj.origin + baseUrlObj.pathname,
      normalizedRoute,
    );

    // Validate the URL is within scope
    if (!isWithinScope(fullUrl, startUrl, allowedPaths, excludePaths)) {
      console.log(`Skipping out-of-scope URL: ${fullUrl}`);
      continue;
    }

    // Only add if it's different from what we've seen
    if (
      !Array.from(uniqueUrls).some((existing) =>
        isSameHashRoute(existing, fullUrl),
      )
    ) {
      uniqueUrls.add(fullUrl);
    }
  }

  return Array.from(uniqueUrls);
}

/**
 * Crawls a hash-based documentation site
 */
async function crawlHashBasedSite(options: CrawlOptions) {
  const { jobId, source, libraryId, libraryDescription, scrapeType } = options;
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
            message: `Discovering ${scrapeType} page: ${currentUrl}`,
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
            rawSnippets: [],
            contextMarkdown: undefined,
            scrapeType,
            customEnrichmentPrompt: source.config.customEnrichmentPrompt,
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

/**
 * Crawls a traditional multi-page documentation site
 */
async function crawlTraditionalSite(options: CrawlOptions) {
  const { jobId, source, libraryId, libraryDescription, scrapeType } = options;
  const { startUrl } = source;

  const crawlerConfig = new Configuration({
    persistStorage: false,
  });

  // Determine scope for traditional crawling
  const urlObj = new URL(startUrl);
  const pathParts = urlObj.pathname.split('/').filter((p) => p);

  // Build scope glob based on allowed paths or default to start URL path
  const scopeGlobs = [
    pathParts.length > 0
      ? `${urlObj.origin}/${pathParts[0]}/**`
      : `${urlObj.origin}/**`,
  ];

  const crawler = new PlaywrightCrawler(
    {
      maxRequestsPerCrawl: source.config.maxDepth || 1000,
      maxConcurrency: scrapeType === 'code' ? 5 : 1,

      async requestHandler({ request, enqueueLinks, log }) {
        log.info(`[Job ${jobId}] Discovering URL: ${request.url}`);

        sendEvent(jobId, {
          type: 'progress',
          message: `Discovering ${scrapeType} page: ${request.url}`,
        });

        // Create job for this URL
        const job: EmbeddingJobPayload = {
          jobId,
          libraryId,
          libraryName: source.name,
          libraryDescription,
          sourceUrl: request.url,
          rawSnippets: [],
          contextMarkdown: undefined,
          scrapeType,
          customEnrichmentPrompt: source.config.customEnrichmentPrompt,
        };

        await enqueueEmbeddingJobs([job]);
        log.info(`Enqueued URL for processing: ${request.url}`);

        // Continue traditional crawling
        await enqueueLinks({
          selector: 'a',
          globs: scopeGlobs,
          strategy: 'same-hostname',
        });
      },

      failedRequestHandler({ request, log }, error) {
        log.error(
          `Failed to discover: ${request.url}. Error: ${error.message}`,
        );
        sendEvent(jobId, {
          type: 'warning',
          message: `Failed to discover: ${request.url}. Reason: ${error.message}`,
        });
      },
    },
    crawlerConfig,
  );

  console.log(
    `[Job ${jobId}] Starting traditional crawl for ${libraryId} at ${startUrl}...`,
  );
  await crawler.run([startUrl]);
  console.log(
    `[Job ${jobId}] Traditional crawl for ${libraryId} finished successfully.`,
  );
}

/**
 * Main entry point that determines the crawling strategy
 */
export async function crawlWithHashSupport(
  jobId: string,
  source: WebScrapeSource,
  libraryId: string,
  libraryDescription: string,
  scrapeType: 'documentation' | 'code',
) {
  const options: CrawlOptions = {
    jobId,
    source,
    libraryId,
    libraryDescription,
    scrapeType,
  };

  // Check if we should use hash-based crawling
  if (detectHashBasedRouting(source.startUrl)) {
    console.log(
      `[Job ${jobId}] Detected hash-based routing, using hash-aware crawler`,
    );
    await crawlHashBasedSite(options);
  } else {
    console.log(`[Job ${jobId}] Using traditional crawler for multi-page site`);
    await crawlTraditionalSite(options);
  }
}
