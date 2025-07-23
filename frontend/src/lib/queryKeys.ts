/**
 * Query key factory for consistent cache key management
 * This helps with cache invalidation and prevents key collisions
 */
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: string) => [...jobKeys.lists(), { filters }] as const,
  batches: () => [...jobKeys.all, 'batch'] as const,
  batch: (jobId: string) => [...jobKeys.batches(), jobId] as const,
  library: (libraryId: string) => [...jobKeys.all, 'library', libraryId] as const,
};

export const libraryKeys = {
  all: ['libraries'] as const,
  lists: () => [...libraryKeys.all, 'list'] as const,
  list: (filters?: { search?: string }) => [...libraryKeys.lists(), { filters }] as const,
  detail: (id: string) => [...libraryKeys.lists(), id] as const,
  search: (query: string) => [...libraryKeys.lists(), { search: query }] as const,
  doc: (id: string, topic?: string) => [...libraryKeys.detail(id), 'documentation', { topic }] as const,
  latestJob: (id: string) => [...libraryKeys.detail(id), 'latest-job'] as const,
};

// Usage examples:
// queryClient.invalidateQueries({ queryKey: jobKeys.all }) // Invalidate everything job-related
// queryClient.invalidateQueries({ queryKey: jobKeys.batch(jobId) }) // Specific batch
// queryClient.invalidateQueries({ queryKey: jobKeys.library(libraryId) }) // All jobs for library
// queryClient.invalidateQueries({ queryKey: libraryKeys.all }) // All library data