import { useSSEQuery } from '../useSSEQuery';
import { jobKeys } from '../../lib/queryKeys';
import { getAllJobsForLibrary } from '../../services/api';

export function useLibraryJobs(libraryId: string, enabled = true) {
  return useSSEQuery(
    jobKeys.library(libraryId),
    () => getAllJobsForLibrary(libraryId),
    {
      enabled: enabled && !!libraryId,
      staleTime: 30 * 1000, // 30 seconds
      resourceType: 'library',
      resourceId: libraryId,
      onEvent: (event) => {
        console.log('Library jobs SSE event:', event);
        // Events like 'resource:added', 'resource:adding', etc. will automatically trigger re-fetch
      },
    }
  );
}