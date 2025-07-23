import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addLibraryResource } from '../../services/api';
import { libraryKeys } from '../../lib/queryKeys';
import type { DocumentationSource } from 'backend/src/lib/types';

export function useAddLibraryResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { libraryId: string; source: DocumentationSource }) =>
      addLibraryResource(data.libraryId, data.source),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.detail(variables.libraryId),
      });
    },
  });
}