import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startCrawl } from '../../services/api';
import { jobKeys } from '../../lib/queryKeys';

export function useStartCrawl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startCrawl,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}