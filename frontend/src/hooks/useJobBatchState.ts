import { useReducer, useEffect, useCallback } from 'react';
import {
  getCrawlJobStatus,
  processSingleJob,
  processAllJobs,
  deleteJob
} from '../services/api';
import type { JobBatch, JobItem } from '../types';

interface JobBatchState {
  // Core data
  batch: JobBatch;

  // UI state
  isExpanded: boolean;
  isLoading: boolean;
  isProcessing: boolean;

  // Selection and filtering
  selectedIds: Set<number>;
  filterText: string;

  // Error state
  error: string | null;
}

type JobBatchAction =
  | { type: 'TOGGLE_EXPANDED' }
  | { type: 'SET_FILTER'; text: string }
  | { type: 'TOGGLE_SELECTION'; id: number }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'FETCH_STATUS_START' }
  | { type: 'FETCH_STATUS_POLLING' }
  | { type: 'FETCH_STATUS_SUCCESS'; data: JobBatch }
  | { type: 'FETCH_STATUS_ERROR'; error: string }
  | { type: 'PROCESS_ALL_START' }
  | { type: 'PROCESS_SINGLE_START'; id: number }
  | { type: 'DELETE_JOB_START'; id: number }
  | { type: 'OPERATION_SUCCESS' }
  | { type: 'OPERATION_ERROR'; error: string }
  | { type: 'UPDATE_JOB_STATUS'; id: number; status: string };

function jobBatchReducer(state: JobBatchState, action: JobBatchAction): JobBatchState {
  switch (action.type) {
    case 'TOGGLE_EXPANDED':
      return { ...state, isExpanded: !state.isExpanded };

    case 'SET_FILTER':
      return { ...state, filterText: action.text };

    case 'TOGGLE_SELECTION': {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(action.id)) {
        newSelected.delete(action.id);
      } else {
        newSelected.add(action.id);
      }
      return { ...state, selectedIds: newSelected };
    }

    case 'SELECT_ALL': {
      const allIds = state.batch.jobs
        .filter(job => job.sourceUrl.toLowerCase().includes(state.filterText.toLowerCase()))
        .map(job => job.id);
      return { ...state, selectedIds: new Set(allIds) };
    }

    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: new Set() };

    case 'FETCH_STATUS_START':
      return { ...state, isLoading: true, error: null };

    case 'FETCH_STATUS_POLLING':
      // Polling doesn't show loading state
      return { ...state, error: null };

    case 'FETCH_STATUS_SUCCESS': {
      // Check if processing is complete
      const wasProcessing = state.isProcessing;
      const isNowProcessing = action.data.summary.processing > 0 || action.data.summary.pending > 0;

      return {
        ...state,
        batch: action.data,
        isLoading: false,
        isProcessing: wasProcessing && isNowProcessing, // Only stay processing if we were already processing
        error: null
      };
    }

    case 'FETCH_STATUS_ERROR':
      return { ...state, isLoading: false, error: action.error };

    case 'PROCESS_ALL_START':
      return {
        ...state,
        isProcessing: true,
        error: null
      };

    case 'PROCESS_SINGLE_START': {
      // Optimistic update
      const updatedJobs = state.batch.jobs.map(job =>
        job.id === action.id ? { ...job, status: 'processing' } : job
      );
      const updatedSummary = recalculateSummary(updatedJobs);
      return {
        ...state,
        batch: { ...state.batch, jobs: updatedJobs, summary: updatedSummary },
        isProcessing: true
      };
    }

    case 'DELETE_JOB_START': {
      // Optimistic removal
      const updatedJobs = state.batch.jobs.filter(job => job.id !== action.id);
      const updatedSummary = recalculateSummary(updatedJobs);
      const newSelected = new Set(state.selectedIds);
      newSelected.delete(action.id);

      return {
        ...state,
        batch: { ...state.batch, jobs: updatedJobs, summary: updatedSummary },
        selectedIds: newSelected
      };
    }

    case 'UPDATE_JOB_STATUS': {
      const updatedJobs = state.batch.jobs.map(job =>
        job.id === action.id ? { ...job, status: action.status } : job
      );
      const updatedSummary = recalculateSummary(updatedJobs);
      return {
        ...state,
        batch: { ...state.batch, jobs: updatedJobs, summary: updatedSummary }
      };
    }

    case 'OPERATION_SUCCESS':
      return { ...state };

    case 'OPERATION_ERROR':
      return { ...state, isProcessing: false, error: action.error };

    default:
      return state;
  }
}

function recalculateSummary(jobs: JobItem[]): JobBatch['summary'] {
  return {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };
}

export function useJobBatchState(initialBatch: JobBatch) {
  const [state, dispatch] = useReducer(jobBatchReducer, {
    batch: initialBatch,
    isExpanded: false,
    isLoading: false,
    isProcessing: false,
    selectedIds: new Set<number>(),
    filterText: '',
    error: null
  });

  // Fetch status with optional polling mode
  const fetchStatus = useCallback(async (isPolling = false) => {
    if (!state.isExpanded) return; // Don't fetch if not expanded

    dispatch({ type: isPolling ? 'FETCH_STATUS_POLLING' : 'FETCH_STATUS_START' });
    try {
      const status = await getCrawlJobStatus(initialBatch.jobId);
      // Map CrawlJobStatus to JobBatch format
      const jobBatchData: JobBatch = {
        jobId: initialBatch.jobId,
        createdAt: initialBatch.createdAt,
        summary: status.summary,
        jobs: status.jobs.map(job => ({
          ...job,
          processedAt: null,
          errorMessage: null,
          scrapeType: initialBatch.jobs.find(j => j.id === job.id)?.scrapeType || 'documentation'
        }))
      };
      dispatch({ type: 'FETCH_STATUS_SUCCESS', data: jobBatchData });
    } catch (error) {
      dispatch({ type: 'FETCH_STATUS_ERROR', error: String(error) });
    }
  }, [state.isExpanded, initialBatch.jobId, initialBatch.createdAt, initialBatch.jobs]);

  // Polling effect
  useEffect(() => {
    if (!state.isExpanded) return;

    // Initial fetch (not polling)
    fetchStatus(false);

    // Set up polling if processing
    if (state.isProcessing) {
      const interval = setInterval(() => {
        fetchStatus(true); // This is polling
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [state.isExpanded, state.isProcessing, fetchStatus]);

  // Actions
  const actions = {
    toggleExpanded: () => {
      dispatch({ type: 'TOGGLE_EXPANDED' });
    },

    setFilter: (text: string) => dispatch({ type: 'SET_FILTER', text }),

    toggleSelection: (id: number) => dispatch({ type: 'TOGGLE_SELECTION', id }),

    selectAll: () => dispatch({ type: 'SELECT_ALL' }),

    clearSelection: () => dispatch({ type: 'CLEAR_SELECTION' }),

    processAll: async () => {
      dispatch({ type: 'PROCESS_ALL_START' });
      try {
        await processAllJobs(initialBatch.jobId);
        // Start polling by setting isProcessing
        setTimeout(() => fetchStatus(false), 500); // Fetch status after a short delay
      } catch (error) {
        dispatch({ type: 'OPERATION_ERROR', error: String(error) });
      }
    },

    processSingle: async (id: number) => {
      dispatch({ type: 'PROCESS_SINGLE_START', id });
      try {
        await processSingleJob(id);
        // Start polling
        setTimeout(() => fetchStatus(false), 500);
      } catch (error) {
        dispatch({ type: 'OPERATION_ERROR', error: String(error) });
        // Revert optimistic update
        await fetchStatus(false);
      }
    },

    processSelected: async () => {
      if (state.selectedIds.size === 0) return;

      dispatch({ type: 'PROCESS_ALL_START' });
      try {
        await Promise.all(
          Array.from(state.selectedIds).map(id => processSingleJob(id))
        );
        dispatch({ type: 'CLEAR_SELECTION' });
        // Start polling
        setTimeout(() => fetchStatus(false), 500);
      } catch (error) {
        dispatch({ type: 'OPERATION_ERROR', error: String(error) });
      }
    },

    deleteJob: async (id: number) => {
      dispatch({ type: 'DELETE_JOB_START', id });
      try {
        await deleteJob(id);
      } catch (error) {
        dispatch({ type: 'OPERATION_ERROR', error: String(error) });
        // Revert optimistic update
        await fetchStatus(false);
      }
    },

    deleteSelected: async () => {
      if (state.selectedIds.size === 0) return;

      try {
        await Promise.all(
          Array.from(state.selectedIds).map(id => deleteJob(id))
        );
        await fetchStatus(false); // Refresh after bulk delete
      } catch (error) {
        dispatch({ type: 'OPERATION_ERROR', error: String(error) });
      }
    }
  };

  // Compute derived state
  const filteredJobs = state.batch.jobs.filter(job =>
    job.sourceUrl.toLowerCase().includes(state.filterText.toLowerCase())
  );

  const progressPercent = state.batch.summary.total > 0
    ? (state.batch.summary.completed / state.batch.summary.total) * 100
    : 0;

  return {
    state: {
      ...state,
      filteredJobs,
      displaySummary: state.batch.summary,
      progressPercent
    },
    actions
  };
}