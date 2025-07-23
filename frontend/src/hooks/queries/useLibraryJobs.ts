import { useQuery } from '@tanstack/react-query';
import { jobKeys } from '../../lib/queryKeys';
import { getAllJobsForLibrary } from '../../services/api';

export function useLibraryJobs(libraryId: string, enabled = true) {
  return useQuery({
    queryKey: jobKeys.library(libraryId),
    queryFn: () => getAllJobsForLibrary(libraryId),
    enabled: enabled && !!libraryId,
    staleTime: 30 * 1000, // 30 seconds
  });
}