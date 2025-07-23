import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../../lib/queryKeys';
import { searchLibraries } from '../../services/api';

export function useSearchLibraries(libraryName: string) {
  return useQuery({
    queryKey: libraryKeys.search(libraryName),
    queryFn: () => searchLibraries(libraryName),
    enabled: !!libraryName,
  });
}