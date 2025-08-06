import { PlaywrightCrawler, Configuration } from 'crawlee';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import PQueue from 'p-queue';

const turndownService = new TurndownService({
  codeBlockStyle: 'fenced',
  headingStyle: 'atx',
});

// Create domain-specific rate limiters to avoid overwhelming source sites
const domainQueues = new Map<string, PQueue>();

function getQueueForDomain(url: string): PQueue {
  const domain = new URL(url).hostname;

  if (!domainQueues.has(domain)) {
    // Create a rate-limited queue for this domain
    // Allow 2 requests per second per domain
    domainQueues.set(
      domain,
      new PQueue({
        concurrency: 1,
        interval: 500, // 500ms between requests
        intervalCap: 1,
      }),
    );
  }

  return domainQueues.get(domain)!;
}

export interface FetchResult {
  success: boolean;
  markdown?: string;
  error?: string;
}

/**
 * Fetches fresh markdown content for a single URL.
 * This is used during the processing phase to get up-to-date content.
 */
export async function fetchMarkdownForUrl(
  url: string,
  preExecutionSteps?: string,
): Promise<FetchResult> {
  const queue = getQueueForDomain(url);

  return queue.add<FetchResult>(async () => {
    try {
      const crawlerConfig = new Configuration({
        persistStorage: false,
      });

      let markdown: string | null = null;
      let error: string | null = null;

      const crawler = new PlaywrightCrawler(
        {
          maxRequestsPerCrawl: 1,
          maxConcurrency: 1,
          requestHandlerTimeoutSecs: 30,
          navigationTimeoutSecs: 30,
          async requestHandler({ page, request }) {
            // Wait for page to fully load
            await page.waitForLoadState('networkidle', { timeout: 10000 });

            // Execute pre-execution steps if provided
            if (preExecutionSteps && preExecutionSteps.trim()) {
              try {
                console.log(`Executing pre-execution steps for ${request.url}`);
                await page.evaluate(preExecutionSteps);

                // Wait a bit for any dynamic content changes
                await page.waitForTimeout(1000);
              } catch (error) {
                console.warn(
                  `Pre-execution steps failed for ${request.url}:`,
                  error,
                );
                // Continue with scraping even if pre-execution steps fail
              }
            }

            // For hash-based URLs, wait for content to load
            const urlObj = new URL(request.url);
            if (urlObj.hash && urlObj.hash.length > 1) {
              // Wait for SPA to load content
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
            }

            const html = await page.content();
            const dom = new JSDOM(html, { url });
            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            if (!article || !article.content) {
              throw new Error('No readable content found');
            }

            markdown = turndownService.turndown(article.content);
          },
          failedRequestHandler(_, err) {
            error = err.message;
          },
        },
        crawlerConfig,
      );

      await crawler.run([url]);

      if (error) {
        return { success: false, error };
      }

      if (!markdown) {
        return { success: false, error: 'No content extracted' };
      }

      return { success: true, markdown };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }) as Promise<FetchResult>;
}

/**
 * Fetches fresh code snippets for a single URL.
 * This is used during the processing phase for code-type scraping.
 */
export async function fetchCodeSnippetsForUrl(
  url: string,
): Promise<FetchResult> {
  // For now, we'll implement this similarly to markdown fetching
  // In the future, this could be enhanced with code-specific extraction
  return fetchMarkdownForUrl(url);
}

/**
 * Clears all domain queues. Useful for testing or cleanup.
 */
export function clearDomainQueues(): void {
  domainQueues.clear();
}
