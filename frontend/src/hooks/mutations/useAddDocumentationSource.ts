import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDocumentationSource as apiAddDocumentationSource } from '../../services/api';
import { libraryKeys } from '../../lib/queryKeys';
import type { ApiSpecSource, WebScrapeSource } from 'backend/src/lib/types';


export const useAddDocumentationSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      source: ApiSpecSource | WebScrapeSource;
    }) => {
      const result = await apiAddDocumentationSource(params.source);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
};