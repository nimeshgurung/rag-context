export interface SlopChunk {
  id: string;
  libraryId: string;
  contentType: 'API_OVERVIEW' | 'OPERATION' | 'SCHEMA_DEFINITION';
  content: string;
  metadata: {
    [key: string]: unknown;
  };
}
