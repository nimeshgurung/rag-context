import { SearchResponse } from './types';

export function formatSearchResults(searchResponse: SearchResponse): string {
  if (searchResponse.error) {
    return `An error occurred: ${searchResponse.error}`;
  }

  if (searchResponse.results.length === 0) {
    return 'No libraries found matching your query.';
  }

  return searchResponse.results
    .map(
      (result) => `
ID: ${result.libraryId}
Name: ${result.name}
Description: ${result.description}
Similarity: ${result.similarityScore.toFixed(4)}
`,
    )
    .join('\n---\n');
}
