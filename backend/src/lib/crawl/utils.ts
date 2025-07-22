export function getScopeGlob(url: string): string {
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
