import { Page } from 'playwright';
import {
  normalizeHashRoute,
  buildHashUrl,
  isSameHashRoute,
} from './hashDetection';
import { isWithinScope } from './scope';

/**
 * Extracts all unique hash routes from a page
 */
export async function extractHashRoutes(
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
