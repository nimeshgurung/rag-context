import { QueryClient } from '@tanstack/react-query';
import { jobKeys, libraryKeys } from './queryKeys';

export interface SSEEvent {
  type: string;
  resourceType?: string;
  resourceId?: string;
  data?: unknown;
  [key: string]: unknown;
}

interface SSEConnection {
  eventSource: EventSource;
  listeners: Set<(event: SSEEvent) => void>;
  reconnectAttempts: number;
  reconnectTimer?: number;
}

class SSEManager {
  private connections = new Map<string, SSEConnection>();
  private queryClient: QueryClient | null = null;
  private baseUrl: string;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(baseUrl: string = 'http://localhost:3001/api') {
    this.baseUrl = baseUrl;
  }

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  private getConnectionKey(resourceType: string, resourceId: string): string {
    return `${resourceType}:${resourceId}`;
  }

  subscribe(
    resourceType: 'job' | 'library',
    resourceId: string,
    listener?: (event: SSEEvent) => void
  ): () => void {
    const key = this.getConnectionKey(resourceType, resourceId);

    let connection = this.connections.get(key);

    if (!connection) {
      const eventSource = new EventSource(
        `${this.baseUrl}/events/${resourceType}/${resourceId}/events`
      );

      connection = {
        eventSource,
        listeners: new Set(),
        reconnectAttempts: 0
      };

      // Set up event handlers
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          this.handleEvent(resourceType, resourceId, data);

          // Notify all listeners
          connection!.listeners.forEach(listener => listener(data));
        } catch (error) {
          console.error('Failed to parse SSE event:', error);
        }
      };

      eventSource.onerror = () => {
        console.error(`SSE connection error for ${key}`);
        this.handleReconnect(resourceType, resourceId);
      };

      eventSource.onopen = () => {
        console.log(`SSE connection opened for ${key}`);
        connection!.reconnectAttempts = 0;
      };

      this.connections.set(key, connection);
    }

    if (listener) {
      connection.listeners.add(listener);
    }

    // Return unsubscribe function
    return () => {
      if (listener && connection) {
        connection.listeners.delete(listener);
      }

      // If no more listeners, close the connection
      if (connection && connection.listeners.size === 0) {
        this.disconnect(resourceType, resourceId);
      }
    };
  }

  private handleEvent(_: string, resourceId: string, event: SSEEvent) {
    if (!this.queryClient) return;

    // Handle different event types
    switch (event.type) {
      case 'job:started':
      case 'job:progress':
      case 'job:completed':
      case 'job:failed':
        // Invalidate job batch query
        this.queryClient.invalidateQueries({
          queryKey: jobKeys.batch(resourceId)
        });

        // Also invalidate library jobs if this is a library job
        if (event.libraryId && typeof event.libraryId === 'string') {
          this.queryClient.invalidateQueries({
            queryKey: jobKeys.library(event.libraryId)
          });
        }
        break;

      case 'library:created':
      case 'library:updated':
        // Invalidate library queries
        this.queryClient.invalidateQueries({
          queryKey: libraryKeys.all
        });
        this.queryClient.invalidateQueries({
          queryKey: libraryKeys.detail(resourceId)
        });
        break;

      case 'resource:added':
      case 'resource:processed':
        // Invalidate library documentation
        this.queryClient.invalidateQueries({
          queryKey: libraryKeys.doc(resourceId)
        });
        break;

      case 'processing:started':
      case 'processing:completed':
        // Handle batch processing events
        if (event.jobId && typeof event.jobId === 'string') {
          this.queryClient.invalidateQueries({
            queryKey: jobKeys.batch(event.jobId)
          });
        }
        break;
    }

    // Always invalidate the specific resource
    this.queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey;
        return Array.isArray(queryKey) &&
               queryKey.some(key => key === resourceId);
      }
    });
  }

  private handleReconnect(resourceType: string, resourceId: string) {
    const key = this.getConnectionKey(resourceType, resourceId);
    const connection = this.connections.get(key);

    if (!connection) return;

    connection.reconnectAttempts++;

    if (connection.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${key}`);
      this.disconnect(resourceType, resourceId);
      return;
    }

    // Clear existing timer
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
    }

    // Exponential backoff
    const delay = this.reconnectDelay * Math.pow(2, connection.reconnectAttempts - 1);

    connection.reconnectTimer = window.setTimeout(() => {
      console.log(`Attempting to reconnect ${key} (attempt ${connection.reconnectAttempts})`);

      // Close old connection
      connection.eventSource.close();

      // Create new connection
      const listeners = connection.listeners;
      this.connections.delete(key);

      // Re-subscribe with all existing listeners
      listeners.forEach(listener => {
        this.subscribe(resourceType as 'job' | 'library', resourceId, listener);
      });
    }, delay);
  }

  disconnect(resourceType: string, resourceId: string) {
    const key = this.getConnectionKey(resourceType, resourceId);
    const connection = this.connections.get(key);

    if (connection) {
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer);
      }
      connection.eventSource.close();
      this.connections.delete(key);
      console.log(`SSE connection closed for ${key}`);
    }
  }

  disconnectAll() {
    this.connections.forEach((connection, key) => {
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer);
      }
      connection.eventSource.close();
      console.log(`SSE connection closed for ${key}`);
    });
    this.connections.clear();
  }
}

// Create singleton instance
export const sseManager = new SSEManager();