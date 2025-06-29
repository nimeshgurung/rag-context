const API_BASE_URL = 'http://localhost:3001/api';

interface SearchResult {
  libraryId: string;
  name: string;
  description: string;
  similarityScore: number;
}

export async function searchLibraries(libraryName: string): Promise<SearchResult[]> {
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

export async function fetchLibraryDocumentation(libraryId: string, topic?: string): Promise<string> {
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