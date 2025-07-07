import { useState, useCallback } from 'react';

export interface JobProgressState {
  isProcessing: boolean;
  progress: string[];
}

export interface JobProgressActions {
  startListening: (
    jobId: string,
    onDone?: () => void,
    onError?: (error: unknown) => void,
  ) => EventSource;
  addProgress: (message: string) => void;
  reset: () => void;
  setProcessing: (processing: boolean) => void;
}

export const useJobProgress = () => {
  const [state, setState] = useState<JobProgressState>({
    isProcessing: false,
    progress: [],
  });

  const addProgress = useCallback((message: string) => {
    setState((prev: JobProgressState) => ({
      ...prev,
      progress: [...prev.progress, message],
    }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean) => {
    setState((prev: JobProgressState) => ({ ...prev, isProcessing }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: [],
    });
  }, []);

  const startListening = useCallback(
    (
      jobId: string,
      onDone?: () => void,
      onError?: (error: unknown) => void,
    ) => {
      const eventSource = new EventSource(
        `http://localhost:3001/api/jobs/${jobId}/events`,
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addProgress(data.message);

        if (data.type === 'done') {
          window.dispatchEvent(new CustomEvent('library-added'));
          eventSource.close();
          onDone?.();
        } else if (data.type === 'error') {
          console.error('Job processing error:', data.error);
          addProgress(`Error: ${data.error?.message || 'Unknown error'}`);
          eventSource.close();
          onError?.(data.error);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        addProgress('Connection to server lost.');
        eventSource.close();
        onError?.(err);
      };

      return eventSource;
    },
    [addProgress],
  );

  return {
    ...state,
    startListening,
    addProgress,
    reset,
    setProcessing,
  };
};
