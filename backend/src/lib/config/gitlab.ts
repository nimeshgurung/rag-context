import 'dotenv/config';

/**
 * GitLab configuration for repository ingestion
 */
export const gitlabConfig = {
  // GitLab API base URL (e.g., https://gitlab.com/api/v4)
  baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com/api/v4',

  // Personal Access Token for GitLab API authentication
  token: process.env.GITLAB_TOKEN,

  // Feature flag to enable/disable GitLab ingestion
  enabled: process.env.ENABLE_GITLAB_INGESTION === 'true',

  // Max file size for ingestion (in bytes) - default 10MB
  maxFileSize: process.env.GITLAB_MAX_FILE_SIZE
    ? parseInt(process.env.GITLAB_MAX_FILE_SIZE, 10)
    : 10 * 1024 * 1024,

  // Max number of files to process per repository
  maxFiles: process.env.GITLAB_MAX_FILES
    ? parseInt(process.env.GITLAB_MAX_FILES, 10)
    : 10000,

  // Allowed GitLab hosts for repository ingestion (comma-separated)
  allowedHosts: process.env.GITLAB_ALLOWED_HOSTS
    ? process.env.GITLAB_ALLOWED_HOSTS.split(',').map(h => h.trim())
    : ['gitlab.com'],
};

/**
 * Validate GitLab configuration
 */
export function validateGitLabConfig(): void {
  if (gitlabConfig.enabled && !gitlabConfig.token) {
    throw new Error('GITLAB_TOKEN is required when ENABLE_GITLAB_INGESTION is true');
  }
}

/**
 * Check if a GitLab repository URL is allowed
 */
export function isAllowedGitLabHost(repoUrl: string): boolean {
  try {
    const url = new URL(repoUrl);
    return gitlabConfig.allowedHosts.some(host =>
      url.hostname === host || url.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

/**
 * Extract project path from GitLab repository URL
 * @param repoUrl - GitLab repository URL
 * @returns Project path (e.g., "group/project") or null if invalid
 */
export function extractProjectPath(repoUrl: string): string | null {
  try {
    const url = new URL(repoUrl);
    // Remove leading slash and .git suffix if present
    const path = url.pathname.replace(/^\//, '').replace(/\.git$/, '');

    // Basic validation - should have at least group/project
    if (path.split('/').length >= 2) {
      return path;
    }
    return null;
  } catch {
    return null;
  }
}
