import type { DocumentationSource } from '../../../src/lib/types';

const API_BASE_URL = 'http://localhost:3001/api';

interface SearchResult {
  libraryId: string;
  name: string;
  description: string;
  similarityScore: number;
}

export interface AddSourceResponse {
  success: boolean;
  message: string;
  jobId?: string;
  libraryId?: string;
}

export interface CrawlJobStatus {
  summary: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  jobs: {
    id: number;
    sourceUrl: string;
    status: string;
  }[];
}

export async function searchLibraries(
  libraryName: string,
): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ libraryName }),
  });

  if (!response.ok) {
    throw new Error('Failed to search for libraries');
  }
  return response.json();
}

export async function getLibraries(): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE_URL}/libraries`);
  if (!response.ok) {
    throw new Error('Failed to fetch libraries');
  }
  return response.json();
}

export async function fetchLibraryDocumentation(
  libraryId: string,
  topic?: string,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/docs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ libraryId, topic }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch library documentation');
  }

  const result = await response.json();
  return result.documentation || '';
}

export async function addDocumentationSource(
  source: DocumentationSource,
): Promise<AddSourceResponse> {
  const response = await fetch(`${API_BASE_URL}/libraries/add-source`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(source),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to add documentation source');
  }

  return response.json();
}

export async function startCrawl(data: {
  libraryName: string;
  libraryDescription: string;
  startUrl: string;
  scrapeType: 'code' | 'documentation';
  customEnrichmentPrompt?: string;
}): Promise<{ jobId: string }> {
  const response = await fetch(`${API_BASE_URL}/crawl/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to start crawl');
  }

  return response.json();
}

export async function getCrawlJobStatus(
  jobId: string,
): Promise<CrawlJobStatus> {
  const response = await fetch(`${API_BASE_URL}/crawl/status/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch job status');
  }
  return response.json();
}

export async function deleteJob(jobItemId: number) {
  const response = await fetch(`${API_BASE_URL}/crawl/job/${jobItemId}`, {
    method: 'DELETE',
  });
  return response.json();
}

export async function processSingleJob(jobItemId: number) {
  const response = await fetch(`${API_BASE_URL}/crawl/process/single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: jobItemId }),
  });
  return response.json();
}

export async function processAllJobs(jobId: string) {
  const response = await fetch(`${API_BASE_URL}/crawl/process/all/${jobId}`, {
    method: 'POST',
  });
  return response.json();
}

export async function getLatestJobForLibrary(
  libraryId: string,
): Promise<{ jobId: string | null }> {
  const response = await fetch(
    `${API_BASE_URL}/libraries/${libraryId}/latest-job`,
  );
  if (!response.ok) {
    throw new Error('Failed to fetch latest job for library');
  }
  return response.json();
}

export async function deleteLibrary(
  libraryId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/libraries/${libraryId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete library');
  }
  return response.json();
}

export async function addLibraryResource(
  libraryId: string,
  source: DocumentationSource,
): Promise<{ jobId: string }> {
  const response = await fetch(`${API_BASE_URL}/libraries/${encodeURIComponent(libraryId)}/add-resource`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(source),
  });

  if (!response.ok) {
    throw new Error('Failed to add resource to library');
  }

  return response.json();
}

export async function getAllJobsForLibrary(libraryId: string): Promise<{
  totalJobs: number;
  batches: Array<{
    jobId: string;
    createdAt: string;
    summary: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    jobs: Array<{
      id: number;
      sourceUrl: string;
      status: string;
      processedAt: string | null;
      errorMessage: string | null;
      scrapeType: string;
    }>;
  }>;
}> {
  const response = await fetch(
    `${API_BASE_URL}/libraries/${libraryId}/jobs`,
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get jobs for library');
  }
  return response.json();
}
