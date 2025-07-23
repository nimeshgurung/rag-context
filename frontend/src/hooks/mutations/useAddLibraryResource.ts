import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addLibraryResource } from '../../services/api';
import { libraryKeys } from '../../lib/queryKeys';
import type { DocumentationSource } from 'backend/src/lib/types';

interface MutationContext {
  activeTab?: number; // 0 for search, 1 for jobs
}

export function useAddLibraryResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      libraryId: string;
      source: DocumentationSource;
      context?: MutationContext;
    }) => {
      const result = await addLibraryResource(data.libraryId, data.source);

      return { ...result, libraryId: data.libraryId };
    },
    onSuccess: (data) => {
      // Always invalidate library details
      queryClient.invalidateQueries({
        queryKey: libraryKeys.detail(data.libraryId),
      });
      // Also invalidate the libraries list to ensure it's refreshed
      queryClient.invalidateQueries({
        queryKey: libraryKeys.all,
      });
    },
  });
}