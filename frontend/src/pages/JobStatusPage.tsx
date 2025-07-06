import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  LinearProgress,
  Grid,
  TextField,
  Checkbox,
} from '@mui/material';
import { getCrawlJobStatus, reprocessJob, deleteJob, processSingleJob, processAllJobs } from '../services/api';

interface Job {
  id: number;
  sourceUrl: string;
  status: string;
}

interface JobSummary {
  total: number;
  processing: number;
  completed: number;
  failed: number;
}

interface JobStatus {
  summary: JobSummary;
  jobs: Job[];
}

const JobStatusPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReprocessing, setIsReprocessing] = useState<number | null>(null);
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
      // Stop polling on error
      return true;
    }
    return false;
  }, [jobId]);

  useEffect(() => {
    setIsLoading(true);
    fetchStatus().finally(() => setIsLoading(false));

    const intervalId = setInterval(async () => {
      const shouldStop = await fetchStatus();
      if (shouldStop) {
        clearInterval(intervalId);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [fetchStatus]);

  const handleReprocess = async (jobItemId: number) => {
    setIsReprocessing(jobItemId);
    try {
      await reprocessJob(jobItemId);
      // Optimistically update the UI or wait for next poll
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
        fetchStatus(); // Refresh status after action
      } catch (err) {
        console.error('Failed to delete job:', err);
        alert('Failed to delete job.');
      }
    }
  };

  const handleProcessSingle = async (jobItemId: number) => {
    try {
      await processSingleJob(jobItemId);
      alert('Job is being processed.');
      fetchStatus();
    } catch (err) {
      console.error('Failed to process job:', err);
      alert('Failed to process job.');
    }
  };

  const handleProcessAll = async () => {
    setIsProcessing(true);
    try {
      const result = await processAllJobs();
      alert(result.message);
    } catch (err) {
      console.error('Failed to start processing all jobs:', err);
      alert('Failed to start processing all jobs.');
    } finally {
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

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = filteredJobs.map((n) => n.id);
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

  const filteredJobs =
    status?.jobs.filter((job) =>
      job.sourceUrl.toLowerCase().includes(filterText.toLowerCase()),
    ) || [];

  const progress =
    status && status.summary.total > 0
      ? (status.summary.completed / status.summary.total) * 100
      : 0;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Job Status for: {jobId}
      </Typography>

      <Box sx={{ my: 2 }}>
        <Typography variant="h6">Summary</Typography>
        <Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
          <Grid>
            <Paper sx={{ p: 2 }}>
              <Typography>Total: {status?.summary.total}</Typography>
            </Paper>
          </Grid>
          <Grid>
            <Paper sx={{ p: 2, color: 'info.main' }}>
              <Typography>
                Processing: {status?.summary.processing}
              </Typography>
            </Paper>
          </Grid>
          <Grid>
            <Paper sx={{ p: 2, color: 'success.main' }}>
              <Typography>
                Completed: {status?.summary.completed}
              </Typography>
            </Paper>
          </Grid>
          <Grid>
            <Paper sx={{ p: 2, color: 'error.main' }}>
              <Typography>Failed: {status?.summary.failed}</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ width: '100%', mr: 1 }}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
          <Box sx={{ minWidth: 35 }}>
            <Typography variant="body2" color="text.secondary">{`${Math.round(
              progress,
            )}%`}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleProcessAll}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <CircularProgress size={20} />
            ) : (
              'Process All Pending'
            )}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="secondary"
            disabled={selectedJobIds.size === 0 || isProcessing}
            onClick={handleProcessSelected}
          >
            Process Selected
          </Button>
          <Button
            variant="contained"
            size="small"
            color="error"
            disabled={selectedJobIds.size === 0}
            onClick={handleDeleteSelected}
          >
            Delete Selected
          </Button>
        </Box>
      </Box>

      <TextField
        label="Filter by URL"
        variant="outlined"
        fullWidth
        value={filterText}
        onChange={handleFilterChange}
        sx={{ mb: 2 }}
      />

      {status && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedJobIds.size > 0 &&
                      selectedJobIds.size < filteredJobs.length
                    }
                    checked={
                      filteredJobs.length > 0 &&
                      selectedJobIds.size === filteredJobs.length
                    }
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Source URL</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJobs.map((job) => {
                const isSelected = selectedJobIds.has(job.id);
                return (
                  <TableRow
                    key={job.id}
                    hover
                    onClick={() => handleSelectClick(job.id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    selected={isSelected}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={isSelected} />
                    </TableCell>
                    <TableCell>{job.id}</TableCell>
                    <TableCell>{job.sourceUrl}</TableCell>
                    <TableCell>{job.status}</TableCell>
                    <TableCell>
                      {job.status === 'failed' && (
                        <Button
                          variant="contained"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReprocess(job.id);
                          }}
                          disabled={isReprocessing === job.id}
                        >
                          {isReprocessing === job.id ? <CircularProgress size={20} /> : 'Reprocess'}
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessSingle(job.id);
                        }}
                      >
                        Process
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(job.id);
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default JobStatusPage;