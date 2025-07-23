import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../../lib/queryKeys';
import { getLibraries } from '../../services/api';

export function useLibraries() {
  return useQuery({
    queryKey: libraryKeys.all,
    queryFn: getLibraries,
  });
}