import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../../lib/queryKeys';
import { getLatestJobForLibrary } from '../../services/api';

export function useLatestJobForLibrary(libraryId: string) {
  return useQuery({
    queryKey: libraryKeys.latestJob(libraryId),
    queryFn: () => getLatestJobForLibrary(libraryId),
    enabled: !!libraryId,
  });
}