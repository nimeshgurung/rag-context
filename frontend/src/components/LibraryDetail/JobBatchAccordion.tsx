import React, { useState, useEffect, useCallback } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Chip,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  getCrawlJobStatus,
  deleteJob,
  processSingleJob,
  processAllJobs,
} from '../../services/api';
import JobActions from '../JobStatus/JobActions';
import JobsTable from '../JobStatus/JobsTable';
import { useDialog } from '../../context/DialogProvider';
import type { JobStatus } from '../../types';

interface JobItem {
  id: number;
  sourceUrl: string;
  status: string;
  processedAt: string | null;
  errorMessage: string | null;
  scrapeType: string;
}

interface JobBatch {
  jobId: string;
  createdAt: string;
  summary: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  jobs: JobItem[];
}

interface JobBatchAccordionProps {
  batch: JobBatch;
  index: number;
  defaultExpanded?: boolean;
  onUpdate?: () => void;
}

const JobBatchAccordion: React.FC<JobBatchAccordionProps> = ({
  batch,
  index,
  defaultExpanded = false,
  onUpdate
}) => {
  const { showSnackbar, showConfirm } = useDialog();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await getCrawlJobStatus(batch.jobId);
      setStatus(result);
      if (result.summary.pending === 0 && result.summary.processing === 0) {
        setIsProcessing(false);
      }
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to fetch job status:', err);
    }
  }, [batch.jobId, onUpdate]);

  useEffect(() => {
    if (isExpanded) {
      fetchStatus()
    }
  }, [isExpanded, fetchStatus]);

  // Add polling while processing
  useEffect(() => {
    if (!isExpanded || !isProcessing) return;

    const interval = 2000; // Poll every 2 seconds while processing
    const pollInterval = setInterval(fetchStatus, interval);

    return () => clearInterval(pollInterval);
  }, [isExpanded, isProcessing, fetchStatus]);

  const handleDelete = async (jobItemId: number) => {
    showConfirm(
      'Confirm Deletion',
      'Are you sure you want to delete this job?',
      async () => {
        setProcessingJobId(jobItemId);
        try {
          await deleteJob(jobItemId);
          showSnackbar('Job deleted successfully', 'success');
          await fetchStatus();
        } catch (error) {
          showSnackbar('Failed to delete job: ' + (error as Error)?.message, 'error');
        } finally {
          setProcessingJobId(null);
        }
      },
    );
  };

  const handleProcessSingle = async (jobItemId: number) => {
    setProcessingJobId(jobItemId);
    try {
      await processSingleJob(jobItemId);
      showSnackbar('Processing started', 'success');
      setIsProcessing(true);
      await fetchStatus();
    } catch (error) {
      showSnackbar('Failed to process job: ' + (error as Error)?.message, 'error');
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleProcessAll = async () => {
    showConfirm(
      'Process All Jobs',
      'Are you sure you want to process all pending jobs?',
      async () => {
        try {
          await processAllJobs(batch.jobId);
          showSnackbar('Processing all jobs started', 'success');
          setIsProcessing(true);
          await fetchStatus();
        } catch (error) {
          showSnackbar('Failed to process all jobs: ' + (error as Error)?.message, 'error');
        }
      },
    );
  };

  const handleProcessSelected = async () => {
    if (selectedJobIds.size === 0) return;

    showConfirm(
      'Process Selected Jobs',
      `Are you sure you want to process ${selectedJobIds.size} selected jobs?`,
      async () => {
        try {
          await Promise.all(
            Array.from(selectedJobIds).map((id) => processSingleJob(id)),
          );
          showSnackbar('Processing selected jobs started', 'success');
          setIsProcessing(true);
          setSelectedJobIds(new Set());
          await fetchStatus();
        } catch (error) {
          showSnackbar('Failed to process selected jobs: ' + (error as Error)?.message, 'error');
        }
      },
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedJobIds.size === 0) return;

    showConfirm(
      'Delete Selected Jobs',
      `Are you sure you want to delete ${selectedJobIds.size} selected jobs?`,
      async () => {
        try {
          await Promise.all(
            Array.from(selectedJobIds).map((id) => deleteJob(id)),
          );
          showSnackbar('Selected jobs deleted successfully', 'success');
          setSelectedJobIds(new Set());
          await fetchStatus();
        } catch (error) {
          showSnackbar('Failed to delete selected jobs: ' + (error as Error)?.message, 'error');
        }
      },
    );
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked && status?.jobs) {
      setSelectedJobIds(new Set(status.jobs.map((job) => job.id)));
    } else {
      setSelectedJobIds(new Set());
    }
  };

  const handleSelectClick = (jobId: number) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobIds(newSelected);
  };

  const filteredJobs = status?.jobs.filter((job) =>
    job.sourceUrl.toLowerCase().includes(filterText.toLowerCase())
  ) || [];

  const progress = status
    ? (status.summary.completed / status.summary.total) * 100
    : 0;

  const isActionPending = processingJobId !== null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Accordion
      expanded={isExpanded}
      onChange={(_, expanded) => setIsExpanded(expanded)}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle1">
            Batch {index + 1}: {formatDate(batch.createdAt)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {batch.summary.processing > 0 && <CircularProgress size={16} />}
            <Chip
              size="small"
              label={`${batch.summary.completed}/${batch.summary.total}`}
              color={batch.summary.completed === batch.summary.total ? 'success' : 'default'}
              variant="outlined"
            />
            {batch.summary.processing > 0 && (
              <Chip
                size="small"
                label={`${batch.summary.processing} processing`}
                color="info"
                variant="outlined"
              />
            )}
            {batch.summary.pending > 0 && (
              <Chip
                size="small"
                label={`${batch.summary.pending} pending`}
                color="warning"
                variant="outlined"
              />
            )}
            {batch.summary.failed > 0 && (
              <Chip
                size="small"
                label={`${batch.summary.failed} failed`}
                color="error"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails>

          <Box>
            {/* Progress Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: isProcessing ? '#2196f3' : '#4caf50',
                    },
                  }}
                />
              </Box>
              <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" color="text.secondary">
                  {`${Math.round(progress)}%`}
                </Typography>
              </Box>
            </Box>

            {/* Processing Status */}
            {isProcessing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="primary">
                  Processing jobs in the background...
                </Typography>
              </Box>
            )}

            {/* Job Actions */}
            <JobActions
              filterText={filterText}
              onFilterChange={(event) => setFilterText(event.target.value)}
              onProcessSelected={handleProcessSelected}
              onDeleteSelected={handleDeleteSelected}
              onProcessAll={handleProcessAll}
              selectedJobIds={selectedJobIds}
              isActionPending={isActionPending}
              isProcessing={isProcessing}
            />

            {/* Jobs Table */}
            <JobsTable
              jobs={filteredJobs}
              selectedJobIds={selectedJobIds}
              onSelectAllClick={handleSelectAllClick}
              onSelectClick={handleSelectClick}
              onProcessSingle={handleProcessSingle}
              onDelete={handleDelete}
              processingJobId={processingJobId}
              isActionPending={isActionPending}
            />
          </Box>

      </AccordionDetails>
    </Accordion>
  );
};

export default JobBatchAccordion;