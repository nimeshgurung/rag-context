interface LibrarySearchResult {
  libraryId: string;
  name: string;
  description: string;
  similarityScore: number;
}

interface SearchResponse {
  results: LibrarySearchResult[];
  error?: string;
}

class BackendClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async searchLibraries(libraryName: string): Promise<SearchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/libraries/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ libraryName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const results = await response.json();
      return { results };
    } catch (error) {
      console.error('Failed to search libraries:', error);
      return {
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async fetchLibraryDocumentation(
    libraryId: string,
    options: { topic?: string; tokens?: number } = {}
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/docs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          libraryId,
          topic: options.topic,
          tokens: options.tokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.documentation || '';
    } catch (error) {
      console.error('Failed to fetch library documentation:', error);
      return `Error fetching documentation: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    }
  }
}

// Create a singleton instance
const backendClient = new BackendClient(process.env.BACKEND_URL);

export { backendClient, type LibrarySearchResult, type SearchResponse };