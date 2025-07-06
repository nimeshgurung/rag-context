import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getCrawlJobStatus,
  reprocessJob,
  deleteJob,
  processSingleJob,
  processAllJobs,
} from '../../services/api';
import type { Job, JobStatus } from '../../types';

export const useJobStatus = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReprocessing, setIsReprocessing] = useState<number | null>(null);
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;
    try {
      const result = await getCrawlJobStatus(jobId);
      setStatus(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to fetch job status.');
      return true; // Stop polling on error
    }
    return false;
  }, [jobId]);

  useEffect(() => {
    setIsLoading(true);
    fetchStatus().finally(() => setIsLoading(false));

    // Use faster polling when processing is active
    const pollInterval = isProcessing ? 2000 : 5000;
    const intervalId = setInterval(async () => {
      const shouldStop = await fetchStatus();
      if (shouldStop) {
        clearInterval(intervalId);
      }
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [fetchStatus, isProcessing]);

  const handleReprocess = async (jobItemId: number) => {
    setIsReprocessing(jobItemId);
    try {
      await reprocessJob(jobItemId);
      fetchStatus();
    } catch (err) {
      console.error('Failed to reprocess job', err);
    } finally {
      setIsReprocessing(null);
    }
  };

  const handleDelete = async (jobItemId: number) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await deleteJob(jobItemId);
        fetchStatus();
      } catch (err) {
        console.error('Failed to delete job:', err);
        alert('Failed to delete job.');
      }
    }
  };

  const handleProcessSingle = async (jobItemId: number) => {
    setProcessingJobId(jobItemId);
    try {
      await processSingleJob(jobItemId);
      fetchStatus();
    } catch (err) {
      console.error('Failed to process job:', err);
      alert('Failed to process job.');
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleProcessAll = async () => {
    setIsProcessing(true);
    try {
      await processAllJobs();
      // Start monitoring the job status more frequently
      const monitorInterval = setInterval(async () => {
        const currentStatus = await getCrawlJobStatus(jobId!);
        setStatus(currentStatus);
        
        // Stop monitoring when all jobs are no longer pending or processing
        if (currentStatus.summary.pending === 0 && currentStatus.summary.processing === 0) {
          clearInterval(monitorInterval);
          setIsProcessing(false);
        }
      }, 1000); // Check every second during processing
      
      // Safety timeout to stop monitoring after 5 minutes
      setTimeout(() => {
        clearInterval(monitorInterval);
        setIsProcessing(false);
      }, 300000);
      
    } catch (err) {
      console.error('Failed to start processing all jobs:', err);
      alert('Failed to start processing all jobs.');
      setIsProcessing(false);
    }
  };

  const handleProcessSelected = async () => {
    setIsProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedJobIds).map((id) => processSingleJob(id)),
      );
      alert('Selected jobs are being processed.');
      setSelectedJobIds(new Set());
      fetchStatus();
    } catch (err) {
      console.error('Failed to process selected jobs:', err);
      alert('An error occurred while processing selected jobs.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedJobIds.size} jobs?`,
      )
    ) {
      try {
        await Promise.all(
          Array.from(selectedJobIds).map((id) => deleteJob(id)),
        );
        alert('Selected jobs have been deleted.');
        setSelectedJobIds(new Set());
        fetchStatus();
      } catch (err) {
        console.error('Failed to delete selected jobs:', err);
        alert('An error occurred while deleting selected jobs.');
      }
    }
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

  const isActionPending =
    isProcessing || isReprocessing !== null || processingJobId !== null;

  return {
    jobId,
    status,
    isLoading,
    error,
    isReprocessing,
    processingJobId,
    isProcessing,
    filterText,
    selectedJobIds,
    filteredJobs,
    progress,
    isActionPending,
    handleReprocess,
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