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

export interface DocsSource {
  type: 'openapi' | 'web';
  url?: string;
  rootUrl?: string;
  scope?: string[];
}

export interface LibraryConfig {
  libraryId: string;
  name: string;
  description: string;
  sources: DocsSource[];
}

export interface DocsSourcesConfig {
  libraries: LibraryConfig[];
}

export interface EnrichedItem {
  title: string;
  description: string;
  code: string;
  language: string;
}

export type ApiSpecSource = {
  type: 'api-spec';
  name: string;
  description: string;
  sourceType: 'file' | 'text';
  content: string;
};

export type WebScrapeSource = {
  type: 'web-scrape';
  name: string;
  description: string;
  startUrl: string;
  config: {
    preExecutionSteps?: string;
    additionalInstructions?: string;
  };
};

export type GitlabRepoSource = {
  type: 'gitlab-repo';
  name: string;
  description: string;
  repoUrl: string;
  ref?: string; // Branch, tag, or commit SHA (optional)
  config: {
    includeGlobs?: string[]; // File patterns to include
    excludeGlobs?: string[]; // File patterns to exclude
    additionalInstructions?: string;
  };
};

export type DocumentationSource = ApiSpecSource | WebScrapeSource | GitlabRepoSource;
