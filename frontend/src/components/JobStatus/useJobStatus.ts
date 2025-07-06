import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCrawlJobStatus,
  deleteJob,
  processSingleJob,
  processAllJobs,
} from '../../services/api';
import type { Job, JobStatus } from '../../types';
import { useDialog } from '../../context/DialogProvider';

export const useJobStatus = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { showSnackbar, showConfirm } = useDialog();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;
    try {
      const result = await getCrawlJobStatus(jobId);
      setStatus(result);
      if (result.summary.pending === 0 && result.summary.processing === 0) {
        setIsProcessing(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to fetch job status.');
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    setIsLoading(true);
    fetchStatus().finally(() => setIsLoading(false));
  }, [jobId, fetchStatus]);

  useEffect(() => {
    if (!jobId || isLoading) return;

    const interval = isProcessing ? 2000 : 5000;
    const pollInterval = setInterval(fetchStatus, interval);

    return () => clearInterval(pollInterval);
  }, [jobId, isLoading, isProcessing, fetchStatus]);

  const handleDelete = async (jobItemId: number) => {
    showConfirm(
      'Delete Job',
      'Are you sure you want to delete this job?',
      async () => {
        try {
          await deleteJob(jobItemId);
          fetchStatus();
          showSnackbar('Job deleted successfully', 'success');
        } catch (err) {
          console.error('Failed to delete job:', err);
          showSnackbar('Failed to delete job', 'error');
        }
      }
    );
  };

  const handleProcessSingle = async (jobItemId: number) => {
    setProcessingJobId(jobItemId);
    try {
      await processSingleJob(jobItemId);
      fetchStatus();
      showSnackbar('Job processed successfully', 'success');
    } catch (err) {
      console.error('Failed to process job:', err);
      showSnackbar('Failed to process job', 'error');
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleProcessAll = async () => {
    if (!jobId) return;

    setIsProcessing(true);
    try {
      await processAllJobs(jobId);
      fetchStatus();
      showSnackbar('All jobs processing started', 'success');
    } catch (err) {
      console.error(
        'Failed to start processing all jobs for the library:',
        err,
      );
      showSnackbar('An error occurred while starting job processing', 'error');
      setIsProcessing(false);
    }
  };

  const handleProcessSelected = async () => {
    setIsProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedJobIds).map((id) => processSingleJob(id)),
      );
      showSnackbar('Selected jobs are being processed', 'success');
      setSelectedJobIds(new Set());
      fetchStatus();
    } catch (err) {
      console.error('Failed to process selected jobs:', err);
      showSnackbar('An error occurred while processing selected jobs', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    showConfirm(
      'Delete Selected Jobs',
      `Are you sure you want to delete ${selectedJobIds.size} jobs?`,
      async () => {
        try {
          await Promise.all(
            Array.from(selectedJobIds).map((id) => deleteJob(id)),
          );
          showSnackbar('Selected jobs have been deleted', 'success');
          setSelectedJobIds(new Set());
          fetchStatus();
        } catch (err) {
          console.error('Failed to delete selected jobs:', err);
          showSnackbar('An error occurred while deleting selected jobs', 'error');
        }
      }
    );
  };

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(event.target.value);
  };

  const filteredJobs =
    status?.jobs.filter((job: Job) =>
      job.sourceUrl.toLowerCase().includes(filterText.toLowerCase()),
    ) || [];

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredJobs.map((n: Job) => n.id);
      setSelectedJobIds(new Set(newSelecteds));
      return;
    }
    setSelectedJobIds(new Set());
  };

  const handleSelectClick = (id: number) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedJobIds(newSelected);
  };

  const progress =
    status && status.summary.total > 0
      ? (status.summary.completed / status.summary.total) * 100
      : 0;

  const isActionPending = isProcessing || processingJobId !== null;

  return {
    jobId,
    status,
    isLoading,
    error,
    processingJobId,
    isProcessing,
    filterText,
    selectedJobIds,
    filteredJobs,
    progress,
    isActionPending,
    handleDelete,
    handleProcessSingle,
    handleProcessAll,
    handleProcessSelected,
    handleDeleteSelected,
    handleFilterChange,
    handleSelectAllClick,
    handleSelectClick,
  };
};
