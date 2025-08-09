import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../../lib/queryKeys';
import { getLibraryStats } from '../../services/api';
import type { LibraryStats } from '../../types';

/**
 * Hook to fetch library statistics (tokens, snippets, chunks) for GitLab/WebScrape content only.
 * Returns 0s for libraries with no GitLab/WebScrape content or on error.
 *
 * @param libraryId - The ID of the library to get stats for
 * @param options - Query options
 * @returns Query result with LibraryStats data
 */
export const useLibraryStats = (
  libraryId: string | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnMount?: boolean;
  }
) => {
  return useQuery<LibraryStats, Error>({
    queryKey: libraryKeys.stats(libraryId || ''),
    queryFn: () => getLibraryStats(libraryId!),
    enabled: !!libraryId && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes default
    refetchOnMount: options?.refetchOnMount ?? false,
    retry: (failureCount, error) => {
      // Don't retry on 404 or other client errors
      if (error?.message?.includes('404') || error?.message?.includes('400')) {
        return false;
      }
      return failureCount < 2;
    },
    // Return zeros on error to prevent UI failures
    placeholderData: libraryId ? {
      libraryId,
      totalChunks: 0,
      totalSnippets: 0,
      totalTokens: 0,
    } : undefined,
  });
};

/**
 * Utility hook to check if library stats should be displayed.
 * Returns true if the library has any GitLab/WebScrape content.
 *
 * @param libraryId - The ID of the library to check
 * @returns boolean indicating if stats should be shown
 */
export const useShouldShowLibraryStats = (libraryId: string | undefined) => {
  const { data: stats } = useLibraryStats(libraryId, {
    staleTime: 10 * 60 * 1000, // 10 minutes for this check
  });

  // Show stats if there are any chunks (meaning GitLab/WebScrape content exists)
  return stats && stats.totalChunks > 0;
};

