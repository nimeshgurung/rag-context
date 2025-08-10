import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobKeys } from '../../lib/queryKeys';
import {
  getCrawlJobStatus,
  processSingleJob,
  processAllJobs,
  processSelectedJobs,
  deleteJob,
  type ProcessAllJobsResponse,
} from '../../services/api';
import type { JobBatch, JobItem } from '../../types';
import { useSSEQuery } from '../useSSEQuery';
import type { SSEEvent } from '../../lib/sse-manager';

interface UseJobBatchOptions {
  enabled?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onEvent?: (event: SSEEvent) => void;
}

// Helper function to recalculate summary
function recalculateSummary(jobs: JobItem[]): JobBatch['summary'] {
  return {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };
}

export function useJobBatch(jobId: string, options: UseJobBatchOptions = {}) {
  const queryClient = useQueryClient();
  const { enabled = false, onSuccess, onError, onEvent } = options;

  // Fetch job batch status with SSE updates
  const query = useSSEQuery(
    jobKeys.batch(jobId),
    async () => {
      const status = await getCrawlJobStatus(jobId);
      // Map to JobBatch format
      const jobBatchData: JobBatch = {
        jobId,
        createdAt: new Date().toISOString(), // This should come from API
        summary: status.summary,
        jobs: status.jobs.map(job => ({
          ...job,
          processedAt: job.processedAt ?? null, // Convert undefined to null
        }))
      };
      return jobBatchData;
    },
    {
      enabled,
      resourceType: 'job',
      resourceId: jobId,
      onEvent: (event) => {
        console.log('Job batch SSE event:', event);
        onEvent?.(event);
      },
      // No more refetchInterval needed - SSE handles updates
    }
  );

  // Process all jobs mutation
  const processAllMutation = useMutation<
    ProcessAllJobsResponse,
    Error,
    void,
    { previousData?: JobBatch }
  >({
    mutationFn: () => processAllJobs(jobId),
    onMutate: async (): Promise<{ previousData?: JobBatch }> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: jobKeys.batch(jobId) });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<JobBatch>(jobKeys.batch(jobId));

      // Only optimistically update if we expect success (not for 202/429)
      return { previousData };
    },
    onError: (err, _, context) => {
      // Revert optimistic update if any
      if (context?.previousData) {
        queryClient.setQueryData(jobKeys.batch(jobId), context.previousData);
      }
      // We use fetch, not axios; err is a generic Error. Surface it.
      onError?.(err);
    },
    onSuccess: (result) => {
      // Handle different success scenarios
      if (result) {
        if (!result.success && (result.statusCode === 202 || result.statusCode === 429)) {
          // These are handled as "success" but with specific meanings
          console.log(`Process all result: ${result.message}`);
        } else if (result.success) {
          // Actual success - optimistically update to show processing started
          const previousData = queryClient.getQueryData<JobBatch>(jobKeys.batch(jobId));
          if (previousData) {
            queryClient.setQueryData<JobBatch>(jobKeys.batch(jobId), {
              ...previousData,
              summary: {
                ...previousData.summary,
                processing: previousData.summary.pending + previousData.summary.processing,
                pending: 0,
              },
              jobs: previousData.jobs.map(job =>
                job.status === 'pending' ? { ...job, status: 'processing' } : job
              )
            });
          }
        }
      }

      onSuccess?.();
    },
  });

  // Process single job mutation
  const processSingleMutation = useMutation({
    mutationFn: (jobItemId: number) => processSingleJob(jobItemId),
    onMutate: async (jobItemId) => {
      await queryClient.cancelQueries({ queryKey: jobKeys.batch(jobId) });

      const previousData = queryClient.getQueryData<JobBatch>(jobKeys.batch(jobId));

      // Optimistic update for specific job
      if (previousData) {
        const updatedJobs = previousData.jobs.map(job =>
          job.id === jobItemId ? { ...job, status: 'processing' } : job
        );

        queryClient.setQueryData<JobBatch>(jobKeys.batch(jobId), {
          ...previousData,
          jobs: updatedJobs,
          summary: recalculateSummary(updatedJobs),
        });
      }

      return { previousData };
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(jobKeys.batch(jobId), context.previousData);
      }
      onError?.(err as Error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.batch(jobId) });
      onSuccess?.();
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: (jobItemId: number) => deleteJob(jobItemId),
    onMutate: async (jobItemId) => {
      await queryClient.cancelQueries({ queryKey: jobKeys.batch(jobId) });

      const previousData = queryClient.getQueryData<JobBatch>(jobKeys.batch(jobId));

      // Optimistic removal
      if (previousData) {
        const updatedJobs = previousData.jobs.filter(job => job.id !== jobItemId);

        queryClient.setQueryData<JobBatch>(jobKeys.batch(jobId), {
          ...previousData,
          jobs: updatedJobs,
          summary: recalculateSummary(updatedJobs),
        });
      }

      return { previousData };
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(jobKeys.batch(jobId), context.previousData);
      }
      onError?.(err as Error);
    },
    onSuccess: () => {
      // Invalidate both batch and library queries
      queryClient.invalidateQueries({ queryKey: jobKeys.batch(jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      onSuccess?.();
    },
  });

  // Process multiple selected jobs
  const processSelectedMutation = useMutation({
    mutationFn: async (jobItemIds: number[]) => {
      await processSelectedJobs(jobId, jobItemIds);
    },
    onMutate: async (jobItemIds) => {
      await queryClient.cancelQueries({ queryKey: jobKeys.batch(jobId) });

      const previousData = queryClient.getQueryData<JobBatch>(jobKeys.batch(jobId));

      // Optimistic update for all selected jobs
      if (previousData) {
        const updatedJobs = previousData.jobs.map(job =>
          jobItemIds.includes(job.id) ? { ...job, status: 'processing' } : job
        );

        queryClient.setQueryData<JobBatch>(jobKeys.batch(jobId), {
          ...previousData,
          jobs: updatedJobs,
          summary: recalculateSummary(updatedJobs),
        });
      }

      return { previousData };
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(jobKeys.batch(jobId), context.previousData);
      }
      onError?.(err as Error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.batch(jobId) });
      onSuccess?.();
    },
  });

  // Delete multiple selected jobs
  const deleteSelectedMutation = useMutation({
    mutationFn: async (jobItemIds: number[]) => {
      await Promise.all(jobItemIds.map(id => deleteJob(id)));
    },
    onMutate: async (jobItemIds) => {
      await queryClient.cancelQueries({ queryKey: jobKeys.batch(jobId) });

      const previousData = queryClient.getQueryData<JobBatch>(jobKeys.batch(jobId));

      // Optimistic removal of all selected jobs
      if (previousData) {
        const updatedJobs = previousData.jobs.filter(job => !jobItemIds.includes(job.id));

        queryClient.setQueryData<JobBatch>(jobKeys.batch(jobId), {
          ...previousData,
          jobs: updatedJobs,
          summary: recalculateSummary(updatedJobs),
        });
      }

      return { previousData };
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(jobKeys.batch(jobId), context.previousData);
      }
      onError?.(err as Error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.batch(jobId) });
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      onSuccess?.();
    },
  });

  // Check if processing actions should be disabled
  const shouldDisableProcessing = () => {
    const batchData = query.data;
    if (!batchData) return false;

    // Disable if any jobs are currently processing
    const hasProcessingJobs = batchData.summary.processing > 0;

    // Disable if mutations are pending
    const hasPendingMutations = processAllMutation.isPending ||
                               processSingleMutation.isPending ||
                               processSelectedMutation.isPending;

    return hasProcessingJobs || hasPendingMutations;
  };

  return {
    // Query state
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,

    // Mutations
    processAll: processAllMutation.mutate,
    processSingle: processSingleMutation.mutate,
    deleteJob: deleteJobMutation.mutate,
    processSelected: processSelectedMutation.mutate,
    deleteSelected: deleteSelectedMutation.mutate,

    // Loading states
    isProcessingAll: processAllMutation.isPending,
    isProcessingSingle: processSingleMutation.isPending,
    isDeletingJob: deleteJobMutation.isPending,
    isProcessingSelected: processSelectedMutation.isPending,
    isDeletingSelected: deleteSelectedMutation.isPending,

    // General processing state
    isProcessing: processAllMutation.isPending ||
                  processSingleMutation.isPending ||
                  processSelectedMutation.isPending,

    // UI control state
    shouldDisableProcessing: shouldDisableProcessing(),
  };
}