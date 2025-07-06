import { closeConnection } from '../events';
import { DocumentationSource } from '../types';
import { handleApiSpecSource } from './apiSpec';
import { handleWebScrapeSource } from './webScrape';

export async function addDocumentationSource(
  jobId: string,
  source: DocumentationSource,
) {
  try {
    switch (source.type) {
      case 'api-spec':
        await handleApiSpecSource(jobId, source);
        break;
      case 'web-scrape':
        await handleWebScrapeSource(jobId, source);
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
    closeConnection(jobId, { type: 'error', message });
  }
}
