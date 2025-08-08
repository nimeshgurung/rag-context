import { sendEvent } from '../events';
import { DocumentationSource } from '../types';
import { handleApiSpecSource } from './apiSpec';
import { handleWebScrapeSource } from './webScrape';
import { handleGitlabRepoSource } from './gitlabRepo';

export async function addDocumentationSource(
  jobId: string,
  source: DocumentationSource,
  existingLibraryId?: string,
) {
  try {
    switch (source.type) {
      case 'api-spec':
        await handleApiSpecSource(jobId, source, existingLibraryId);
        break;
      case 'web-scrape':
        await handleWebScrapeSource(jobId, source, existingLibraryId);
        break;
      case 'gitlab-repo':
        await handleGitlabRepoSource(jobId, source, existingLibraryId);
        break;
      default:
        throw new Error('Unknown documentation source type');
    }
  } catch (error) {
    console.error(
      `[Job ${jobId}] Failed to process documentation source:`,
      error,
    );
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    sendEvent(jobId, { type: 'error', message });
  }
}
