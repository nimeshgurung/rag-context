/**
 * URL scope validation utilities for crawling
 */

/**
 * Validates if a URL is within the allowed scope
 */
export function isWithinScope(
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
 * Builds scope globs for traditional crawling based on start URL
 */
export function buildScopeGlobs(startUrl: string): string[] {
  const urlObj = new URL(startUrl);
  const pathParts = urlObj.pathname.split('/').filter((p) => p);

  return [
    pathParts.length > 0
      ? `${urlObj.origin}/${pathParts.join('/')}/**`
      : `${urlObj.origin}/**`,
  ];
}
