export interface SlopChunk {
  id: string;
  libraryId: string;
  contentType: 'API_OVERVIEW' | 'OPERATION' | 'SCHEMA_DEFINITION';
  originalText: string;
  metadata: {
    [key: string]: unknown;
  };
}
