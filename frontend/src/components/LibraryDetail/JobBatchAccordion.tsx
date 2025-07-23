import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  LinearProgress,
  Chip,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  PlayArrow,
  Delete,
  CheckCircle,
  Error,
  Schedule,
  HourglassEmpty,
} from '@mui/icons-material';
import { useDialog } from '../../context/DialogProvider';
import { useJobBatch } from '../../hooks/queries/useJobBatch';
import { useJobBatchUI } from '../../hooks/useJobBatchUI';
import type { JobBatch } from '../../types';

interface JobBatchAccordionProps {
  batch: JobBatch;
  index: number;
  defaultExpanded?: boolean;
  onUpdate?: () => void;
}

const JobBatchAccordion: React.FC<JobBatchAccordionProps> = ({
  batch,
  index,
  onUpdate
}) => {
  const { showSnackbar, showConfirm } = useDialog();

  // Local UI state
  const {
    isExpanded,
    setIsExpanded,
    selectedIds,
    filterText,
    setFilterText,
    filteredJobs,
    isAllSelected,
    isIndeterminate,
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
  } = useJobBatch(batch.jobId, {
    enabled: isExpanded,
    onSuccess: () => {
      onUpdate?.();
    },
  });

  // Use live data if available, otherwise use initial batch data
  const displayBatch = data || batch;
  const displayJobs = data ? filteredJobs : batch.jobs;

  // Calculate progress
  const progressPercent = displayBatch.summary.total > 0
    ? (displayBatch.summary.completed / displayBatch.summary.total) * 100
    : 0;

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" fontSize="small" />;
      case 'failed':
        return <Error color="error" fontSize="small" />;
      case 'processing':
        return <HourglassEmpty color="info" fontSize="small" />;
      default:
        return <Schedule color="warning" fontSize="small" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'info';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

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

    showConfirm(
      'Process Selected Jobs',
      `Are you sure you want to process ${selectedIds.size} selected jobs?`,
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
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
          <Typography sx={{ flexGrow: 1 }}>
            Batch #{index + 1} - {formatDate(displayBatch.createdAt)}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            <Chip
              label={`Total: ${displayBatch.summary.total}`}
              size="small"
            />
            {displayBatch.summary.pending > 0 && (
              <Chip
                label={`Pending: ${displayBatch.summary.pending}`}
                color="warning"
                size="small"
              />
            )}
            {displayBatch.summary.processing > 0 && (
              <Chip
                label={`Processing: ${displayBatch.summary.processing}`}
                color="info"
                size="small"
              />
            )}
            {displayBatch.summary.completed > 0 && (
              <Chip
                label={`Completed: ${displayBatch.summary.completed}`}
                color="success"
                size="small"
              />
            )}
            {displayBatch.summary.failed > 0 && (
              <Chip
                label={`Failed: ${displayBatch.summary.failed}`}
                color="error"
                size="small"
              />
            )}
          </Box>

          {progressPercent > 0 && (
            <Box sx={{ width: 100, mr: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                color={displayBatch.summary.failed > 0 ? 'error' : 'primary'}
              />
            </Box>
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error instanceof Error ? error.message : 'Failed to load job status'}
          </Alert>
        )}

        {/* Action Bar */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Filter by URL..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            sx={{ width: '40%' }}
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleProcessSelected}
                  disabled={isProcessing}
                  startIcon={<PlayArrow />}
                >
                  Process Selected ({selectedIds.size})
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  onClick={handleDeleteSelected}
                  disabled={isProcessing}
                  startIcon={<Delete />}
                >
                  Delete Selected
                </Button>
              </>
            )}
            <Button
              variant="contained"
              size="small"
              onClick={handleProcessAll}
              disabled={isProcessing || displayBatch.summary.pending === 0}
              startIcon={isProcessing ? <CircularProgress size={16} /> : <PlayArrow />}
            >
              {isProcessing ? 'Processing...' : 'Process All'}
            </Button>
          </Box>
        </Box>

        {/* Jobs Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={isIndeterminate}
                    checked={isAllSelected}
                    onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  />
                </TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && !data ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : displayJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No jobs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayJobs.map((job) => (
                  <TableRow key={job.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.has(job.id)}
                        onChange={() => toggleSelection(job.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                        {job.sourceUrl}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={job.scrapeType}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getStatusIcon(job.status)}
                                                <Chip
                          label={job.status}
                          size="small"
                          color={getStatusColor(job.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {job.status === 'pending' && (
                          <IconButton
                            size="small"
                            onClick={() => processSingle(job.id)}
                            disabled={isProcessing}
                            title="Process"
                          >
                            <PlayArrow fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteJob(job.id)}
                          disabled={isProcessing}
                          title="Delete"
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
};

export default JobBatchAccordion;