export interface LibrarySearchResult {
  libraryId: string;
  name: string;
  description: string;
  similarityScore: number;
}

export interface SearchResponse {
  results: LibrarySearchResult[];
  error?: string;
}
