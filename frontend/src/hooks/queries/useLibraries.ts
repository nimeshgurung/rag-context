import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../../lib/queryKeys';
import { getLibraries } from '../../services/api';
import { sseManager } from '../../lib/sse-manager';
import { useEffect } from 'react';

export const useLibraries = () => {
  const query = useQuery({
    queryKey: libraryKeys.all,
    queryFn: getLibraries,
  });

  // Subscribe to SSE events for new libraries being created
  useEffect(() => {
    if (!query.isSuccess) return;

    // Subscribe to a special "libraries" channel for global library events
    const unsubscribe = sseManager.subscribe(
      'library',
      'global', // Special ID for library-wide events
      (event) => {
        console.log('Library global SSE event:', event);
        // The SSE manager will automatically invalidate the query
      }
    );

    return unsubscribe;
  }, [query.isSuccess]);

  return query;
};