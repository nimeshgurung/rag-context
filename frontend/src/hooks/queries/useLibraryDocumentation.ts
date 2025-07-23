import { useSSEQuery } from '../useSSEQuery';
import { libraryKeys } from '../../lib/queryKeys';
import { fetchLibraryDocumentation } from '../../services/api';
import type { SSEEvent } from '../../lib/sse-manager';

interface UseLibraryDocumentationOptions {
  enabled?: boolean;
  topic?: string;
  onResourceAdded?: (event: SSEEvent) => void;
  onProcessingComplete?: (event: SSEEvent) => void;
}

export function useLibraryDocumentation(
  libraryId: string,
  options: UseLibraryDocumentationOptions = {}
) {
  const { enabled = true, topic, onResourceAdded, onProcessingComplete } = options;

  return useSSEQuery(
    libraryKeys.doc(libraryId, topic),
    () => fetchLibraryDocumentation(libraryId, topic),
    {
      enabled,
      resourceType: 'library',
      resourceId: libraryId,
      onEvent: (event) => {
        console.log('Library documentation SSE event:', event);

        // Handle specific events
        switch (event.type) {
          case 'resource:added':
            onResourceAdded?.(event);
            break;
          case 'processing:completed':
            onProcessingComplete?.(event);
            break;
        }
      },
    }
  );
}