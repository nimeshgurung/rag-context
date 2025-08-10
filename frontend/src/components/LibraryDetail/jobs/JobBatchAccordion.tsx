import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { useDialog } from '../../../context/DialogProvider';
import { useJobBatch } from '../../../hooks/queries/useJobBatch';
import { useJobBatchUI } from '../../../hooks/useJobBatchUI';
import { AccordionHeader } from './AccordionHeader';
import { ActionBar } from './ActionBar';
import { JobsTable } from './JobsTable';
import type { JobBatch } from '../../../types';

interface JobBatchAccordionProps {
  batch: JobBatch;
  index: number;
  defaultExpanded?: boolean;
  onUpdate?: () => void;
}

export const JobBatchAccordion: React.FC<JobBatchAccordionProps> = ({
  batch,
  index,
  onUpdate
}) => {
  const { showSnackbar, showConfirm } = useDialog();

  // Local UI state first
  const {
    isExpanded,
    setIsExpanded,
    selectedIds,
    filterText,
    setFilterText,
    toggleSelection,
    selectAll,
    clearSelection,
  } = useJobBatchUI(batch.jobs);

  // Server state via React Query
  const {
    data,
    isLoading,
    error,
    processAll,
    processSingle,
    deleteJob,
    processSelected,
    deleteSelected,
    isProcessing,
    shouldDisableProcessing,
  } = useJobBatch(batch.jobId, {
    enabled: isExpanded,
    onSuccess: () => {
      onUpdate?.();
    },
  });

  // Use live data if available, otherwise use initial batch data
  const displayBatch = data || batch;

  const progressPercent = displayBatch.summary.total > 0
    ? (displayBatch.summary.completed / displayBatch.summary.total) * 100
    : 0;

  // Re-filter jobs if we have live data
  const displayJobs = React.useMemo(() => {
    const jobsToFilter = data ? data.jobs : batch.jobs;
    return jobsToFilter.filter(job =>
      job.source.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [data, batch.jobs, filterText]);

  // Recalculate selection states based on displayJobs
  const isAllSelected = displayJobs.length > 0 &&
    displayJobs.every(job => selectedIds.has(job.id));

  const isIndeterminate = displayJobs.some(job => selectedIds.has(job.id)) &&
    !isAllSelected;

  // Calculate what types of jobs are selected
  const selectedJobs = displayJobs.filter(job => selectedIds.has(job.id));
  const hasSelectedPendingJobs = selectedJobs.some(job => job.status === 'pending');
  const hasSelectedCompletedOrFailedJobs = selectedJobs.some(
    job => job.status === 'completed' || job.status === 'failed'
  );

  // Handle actions with confirmations
  const handleProcessAll = () => {
    showConfirm(
      'Process All Jobs',
      'Are you sure you want to process all pending jobs?',
      () => {
        processAll();
        showSnackbar('Processing all jobs started', 'success');
      }
    );
  };

  const handleProcessSelected = () => {
    if (selectedIds.size === 0) return;

    const actionText = hasSelectedCompletedOrFailedJobs
      ? (hasSelectedPendingJobs ? 'process/reprocess' : 'reprocess')
      : 'process';

    showConfirm(
      'Process Selected Jobs',
      `Are you sure you want to ${actionText} ${selectedIds.size} selected jobs?`,
      () => {
        processSelected(Array.from(selectedIds));
        clearSelection();
        showSnackbar('Processing selected jobs started', 'success');
      }
    );
  };

  const handleDeleteJob = (id: number) => {
    showConfirm(
      'Confirm Deletion',
      'Are you sure you want to delete this job?',
      () => {
        deleteJob(id);
        showSnackbar('Job deleted successfully', 'success');
      }
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    showConfirm(
      'Delete Selected Jobs',
      `Are you sure you want to delete ${selectedIds.size} selected jobs?`,
      () => {
        deleteSelected(Array.from(selectedIds));
        clearSelection();
        showSnackbar('Selected jobs deleted', 'success');
      }
    );
  };

  return (
    <Accordion
      expanded={isExpanded}
      onChange={(_, expanded) => setIsExpanded(expanded)}
      sx={{ mb: 2 }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <AccordionHeader
          batch={displayBatch}
          index={index}
          progressPercent={progressPercent}
        />
      </AccordionSummary>

      <AccordionDetails>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error instanceof Error ? error.message : 'Failed to load job status'}
          </Alert>
        )}

        <ActionBar
          filterText={filterText}
          setFilterText={setFilterText}
          selectedIds={selectedIds}
          shouldDisableProcessing={shouldDisableProcessing}
          hasPendingJobs={displayBatch.summary.pending > 0}
          hasSelectedPendingJobs={hasSelectedPendingJobs}
          hasSelectedCompletedOrFailedJobs={hasSelectedCompletedOrFailedJobs}
          onProcessSelected={handleProcessSelected}
          onDeleteSelected={handleDeleteSelected}
          onProcessAll={handleProcessAll}
        />

        <JobsTable
          jobs={displayJobs}
          selectedIds={selectedIds}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          isLoading={isLoading && !data}
          isProcessing={isProcessing}
          shouldDisableProcessing={shouldDisableProcessing}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onToggleSelection={toggleSelection}
          onProcessJob={processSingle}
          onDeleteJob={handleDeleteJob}
        />
      </AccordionDetails>
    </Accordion>
  );
};