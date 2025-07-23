import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from '../../lib/queryKeys';
import { fetchLibraryDocumentation } from '../../services/api';

export function useLibraryDocumentation(libraryId: string, topic?: string) {
  return useQuery({
    queryKey: libraryKeys.doc(libraryId, topic),
    queryFn: () => fetchLibraryDocumentation(libraryId, topic),
    enabled: !!libraryId,
  });
}