import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDocumentationSource } from '../../services/api';
import { libraryKeys } from '../../lib/queryKeys';

export function useAddDocumentationSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addDocumentationSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}