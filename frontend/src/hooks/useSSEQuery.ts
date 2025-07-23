import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  UseQueryOptions,
  UseQueryResult,
  QueryKey
} from '@tanstack/react-query';
import { sseManager } from '../lib/sse-manager';
import type { SSEEvent } from '../lib/sse-manager';

interface UseSSEQueryOptions<TData> extends Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'> {
  resourceType: 'job' | 'library';
  resourceId: string;
  onEvent?: (event: SSEEvent) => void;
}

export function useSSEQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options: UseSSEQueryOptions<TData>
): UseQueryResult<TData> {
  const { resourceType, resourceId, onEvent, ...queryOptions } = options;

  // Store the latest onEvent callback in a ref to avoid subscription restarts
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Standard query with SSE enhancement
  const query = useQuery({
    queryKey,
    queryFn,
    ...queryOptions,
    // Disable polling since we're using SSE
    refetchInterval: false,
  });

  // Subscribe to SSE events when query is enabled
  useEffect(() => {
    if (!query.isSuccess || queryOptions.enabled === false) {
      return;
    }

    // Subscribe to SSE events for this resource
    const unsubscribe = sseManager.subscribe(
      resourceType,
      resourceId,
      (event) => {
        // Use the ref to always call the latest callback
        onEventRef.current?.(event);
      }
    );

    return unsubscribe;
  }, [query.isSuccess, queryOptions.enabled, resourceType, resourceId]);

  return query;
}