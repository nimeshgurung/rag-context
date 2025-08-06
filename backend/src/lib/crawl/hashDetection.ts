/**
 * Utilities for detecting hash-based routing in documentation sites
 */

/**
 * Patterns that indicate hash-based routing
 */
const HASH_ROUTE_PATTERNS = [
  /#\/[a-zA-Z]/, // Hash followed by forward slash and letter
  /#![a-zA-Z]/, // Hashbang routing
  /\/#\/docs\//, // Common docs pattern
  /\/#\/guide\//, // Common guide pattern
  /\/#\/api\//, // Common API pattern
  /\/#\/reference\//, // Common reference pattern
];

/**
 * Checks if a URL appears to use hash-based routing
 */
export function detectHashBasedRouting(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Check if URL has a hash with routing pattern
    if (urlObj.hash.length > 1) {
      // Check for typical hash routing patterns
      for (const pattern of HASH_ROUTE_PATTERNS) {
        if (pattern.test(urlObj.hash)) {
          return true;
        }
      }

      // Check for simple hash with path-like structure
      // Accept #/ as the root of a hash-based SPA
      if (
        urlObj.hash === '#/' ||
        (urlObj.hash.includes('/') && urlObj.hash.length > 2)
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts the route path from a hash URL
 */
export function extractHashRoute(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hash.length > 1) {
      // Remove leading # or #!
      return urlObj.hash.replace(/^#!?/, '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalizes a hash route to ensure consistency
 */
export function normalizeHashRoute(route: string): string {
  // Ensure route starts with /
  if (!route.startsWith('/')) {
    route = '/' + route;
  }

  // Remove trailing slashes except for root
  if (route.length > 1 && route.endsWith('/')) {
    route = route.slice(0, -1);
  }

  // Remove any query parameters or fragments within the hash
  const queryIndex = route.indexOf('?');
  if (queryIndex > -1) {
    route = route.substring(0, queryIndex);
  }

  return route;
}

/**
 * Combines a base URL with a hash route
 */
export function buildHashUrl(baseUrl: string, hashRoute: string): string {
  try {
    const urlObj = new URL(baseUrl);
    // Clear any existing hash
    urlObj.hash = '';

    // Normalize and set the new hash route
    const normalizedRoute = normalizeHashRoute(hashRoute);
    urlObj.hash = normalizedRoute.startsWith('/')
      ? normalizedRoute
      : '/' + normalizedRoute;

    return urlObj.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Checks if two hash URLs point to the same content
 */
export function isSameHashRoute(url1: string, url2: string): boolean {
  const route1 = extractHashRoute(url1);
  const route2 = extractHashRoute(url2);

  if (!route1 || !route2) {
    return url1 === url2;
  }

  return normalizeHashRoute(route1) === normalizeHashRoute(route2);
}
