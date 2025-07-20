export interface SlopChunk {
  id: string;
  libraryId: string;
  contentType:
    | 'API_OVERVIEW'
    | 'OPERATION'
    | 'SCHEMA_DEFINITION'
    | 'guide'
    | 'code-example';
  originalText: string;
  metadata: {
    [key: string]: unknown;
  };
}
