import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { libraries, embeddingJobs } from '../schema';
import { sendEvent } from '../events';
import { GitlabRepoSource } from '../types';
import { gitlabConfig, isAllowedGitLabHost, extractProjectPath } from '../config/gitlab';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { minimatch } from 'minimatch';
import { extract } from 'tar';
import axios from 'axios';

/**
 * Handle GitLab repository source ingestion
 */
export async function handleGitlabRepoSource(
  jobId: string,
  source: GitlabRepoSource,
  existingLibraryId?: string,
) {
  // Validate GitLab configuration
  if (!gitlabConfig.enabled) {
    throw new Error('GitLab ingestion is not enabled. Set ENABLE_GITLAB_INGESTION=true');
  }

  if (!gitlabConfig.token) {
    throw new Error('GITLAB_TOKEN is required for GitLab repository ingestion');
  }

  // Validate repository URL
  if (!isAllowedGitLabHost(source.repoUrl)) {
    throw new Error(`Repository host is not allowed. Allowed hosts: ${gitlabConfig.allowedHosts.join(', ')}`);
  }

  const projectPath = extractProjectPath(source.repoUrl);
  if (!projectPath) {
    throw new Error('Invalid GitLab repository URL format');
  }

  sendEvent(jobId, {
    type: 'status',
    message: `Starting GitLab repository ingestion for ${projectPath}`
  });

  let libraryId = existingLibraryId;
  let tempDir: string | null = null;

  try {
    // Create or use existing library
    if (!libraryId) {
      libraryId = uuidv4();
      await db.insert(libraries).values({
        id: libraryId,
        name: source.name,
        description: source.description,
      });
      sendEvent(jobId, {
        type: 'library_created',
        data: { libraryId, name: source.name }
      });
    }

    // Resolve ref (use default branch if not specified)
    let ref = source.ref;
    if (!ref) {
      sendEvent(jobId, { type: 'status', message: 'Resolving default branch...' });
      ref = await getDefaultBranch(projectPath);
    }

    sendEvent(jobId, {
      type: 'status',
      message: `Downloading repository archive (ref: ${ref})...`
    });

    // Download repository archive
    const archivePath = await downloadRepoArchive(projectPath, ref);

    sendEvent(jobId, { type: 'status', message: 'Extracting archive...' });

    // Extract archive to temp directory
    tempDir = await extractArchive(archivePath);

    // Clean up archive file
    fs.unlinkSync(archivePath);

    sendEvent(jobId, { type: 'status', message: 'Discovering markdown files...' });

    // Collect markdown files
    const markdownFiles = await collectMarkdownFiles(
      tempDir,
      source.config.includeGlobs,
      source.config.excludeGlobs
    );

    sendEvent(jobId, {
      type: 'status',
      message: `Found ${markdownFiles.length} markdown files to process`
    });

    if (markdownFiles.length === 0) {
      sendEvent(jobId, {
        type: 'warning',
        message: 'No markdown files found in repository'
      });
      return;
    }

    // Enqueue embedding jobs for each markdown file
    const jobs = [];
    let enqueuedCount = 0;

    for (const file of markdownFiles) {
      const content = fs.readFileSync(file.path, 'utf-8');

      // Skip empty files
      if (!content.trim()) {
        continue;
      }

      // Check file size
      const stats = fs.statSync(file.path);
      if (stats.size > gitlabConfig.maxFileSize) {
        sendEvent(jobId, {
          type: 'warning',
          message: `Skipping ${file.relativePath}: exceeds max file size`
        });
        continue;
      }

      // Create origin URL for traceability
      const originUrl = `gitlab://${new URL(gitlabConfig.baseUrl).hostname}/${projectPath}@${ref}/${file.relativePath}`;

      // Enqueue job with markdown content stored in source field
      jobs.push({
        jobId,
        libraryId,
        source: content, // Store the actual markdown content
        sourceType: 'gitlab-repo' as const, // Aligned with DocumentationSource type
        originUrl, // Keep track of where it came from
        additionalInstructions: source.config.additionalInstructions || null,
        preExecutionSteps: null,
        status: 'pending',
      });

      enqueuedCount++;

      // Send progress update every 10 files
      if (enqueuedCount % 10 === 0) {
        sendEvent(jobId, {
          type: 'progress',
          data: {
            current: enqueuedCount,
            total: markdownFiles.length
          }
        });
      }
    }

    // Insert all jobs in batch
    if (jobs.length > 0) {
      await db.insert(embeddingJobs).values(jobs);

      sendEvent(jobId, {
        type: 'jobs_enqueued',
        data: {
          count: jobs.length,
          libraryId
        }
      });
    }

    sendEvent(jobId, {
      type: 'complete',
      data: {
        libraryId,
        filesProcessed: markdownFiles.length,
        jobsEnqueued: jobs.length
      }
    });

  } catch (error) {
    console.error(`[Job ${jobId}] GitLab ingestion failed:`, error);
    throw error;
  } finally {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Get the default branch for a GitLab project
 */
async function getDefaultBranch(projectPath: string): Promise<string> {
  const encodedPath = encodeURIComponent(projectPath);
  const url = `${gitlabConfig.baseUrl}/projects/${encodedPath}`;

  console.log(`Fetching project info from: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'PRIVATE-TOKEN': gitlabConfig.token!,
      },
    });

    const project = response.data;
    console.log(`Default branch for ${projectPath}: ${project.default_branch}`);
    return project.default_branch || 'main';
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const statusText = error.response?.statusText || error.message;
    const errorBody = error.response?.data ? JSON.stringify(error.response.data) : error.message;

    console.error(`GitLab API error response: ${status} ${statusText}`);
    console.error(`Error body: ${errorBody}`);
    throw new Error(`Failed to fetch project info: ${status} ${statusText} - ${errorBody}`);
  }
}

/**
 * Download repository archive from GitLab
 */
async function downloadRepoArchive(projectPath: string, ref: string): Promise<string> {
  const encodedPath = encodeURIComponent(projectPath);
  const encodedRef = encodeURIComponent(ref);
  const url = `${gitlabConfig.baseUrl}/projects/${encodedPath}/repository/archive.tar.gz`;

  console.log(`Attempting to download archive from: ${url}?sha=${encodedRef}`);
  console.log(`Using token: ${gitlabConfig.token ? 'Yes (length: ' + gitlabConfig.token.length + ')' : 'No'}`);

  try {
    // Use axios to download the archive
    const response = await axios.get(url, {
      headers: {
        'PRIVATE-TOKEN': gitlabConfig.token!,
      },
      params: {
        sha: encodedRef,
      },
      responseType: 'stream', // Important for binary data
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);

    // Save to temp file
    const tempFile = path.join(os.tmpdir(), `gitlab-repo-${Date.now()}.tar.gz`);
    const fileStream = createWriteStream(tempFile);

    // Pipe the response stream to file
    await pipeline(response.data, fileStream);

    return tempFile;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const statusText = error.response?.statusText || error.message;
    let errorBody = error.message;

    // Try to read error body from stream if present
    if (error.response?.data) {
      try {
        let chunks = '';
        for await (const chunk of error.response.data) {
          chunks += chunk.toString();
        }
        errorBody = chunks;
      } catch {
        // If reading stream fails, use the error message
      }
    }

    console.error(`GitLab API error response: ${status} ${statusText}`);
    console.error(`Error body: ${errorBody}`);
    throw new Error(`Failed to download repository archive: ${status} ${statusText} - ${errorBody}`);
  }
}

/**
 * Extract tar.gz archive
 */
async function extractArchive(archivePath: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `gitlab-extract-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  await extract({
    file: archivePath,
    cwd: tempDir,
  });

  return tempDir;
}

/**
 * Collect markdown files from directory
 */
async function collectMarkdownFiles(
  dir: string,
  includeGlobs?: string[],
  excludeGlobs?: string[],
): Promise<Array<{ path: string; relativePath: string }>> {
  const files: Array<{ path: string; relativePath: string }> = [];
  const visited = new Set<string>();

  // Default patterns
  const includePatterns = includeGlobs?.length ? includeGlobs : ['**/*.md', '**/*.mdx'];
  const excludePatterns = excludeGlobs?.length ? excludeGlobs : [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
  ];

  function shouldInclude(filePath: string): boolean {
    const relativePath = path.relative(dir, filePath);

    // Check exclude patterns first
    for (const pattern of excludePatterns) {
      if (minimatch(relativePath, pattern, { matchBase: true })) {
        return false;
      }
    }

    // Check include patterns
    for (const pattern of includePatterns) {
      if (minimatch(relativePath, pattern, { matchBase: true })) {
        return true;
      }
    }

    return false;
  }

  async function walk(currentDir: string) {
    if (visited.has(currentDir)) return;
    visited.add(currentDir);

    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (shouldInclude(fullPath)) {
          files.push({
            path: fullPath,
            relativePath: path.relative(dir, fullPath),
          });

          // Check max files limit
          if (files.length >= gitlabConfig.maxFiles) {
            return files;
          }
        }
      }
    }
  }

  await walk(dir);
  return files;
}
