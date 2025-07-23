import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteLibrary } from '../../services/api';
import { libraryKeys } from '../../lib/queryKeys';

export function useDeleteLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
  });
}