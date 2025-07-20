import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Refresh } from '@mui/icons-material';
import { getAllJobsForLibrary } from '../../services/api';
import { useNavigate } from 'react-router-dom';

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

interface JobsData {
  totalJobs: number;
  batches: JobBatch[];
}

interface JobsTabProps {
  libraryId: string;
  onJobsUpdate?: () => void;
}

const JobsTab: React.FC<JobsTabProps> = ({ libraryId, onJobsUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobsData, setJobsData] = useState<JobsData | null>(null);
  const navigate = useNavigate();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllJobsForLibrary(libraryId);
      setJobsData(data);
      // Notify parent of job updates for summary refresh
      if (onJobsUpdate) {
        onJobsUpdate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [libraryId, onJobsUpdate]);

  useEffect(() => {
    if (libraryId) {
      fetchJobs();
    }
  }, [libraryId, fetchJobs]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleViewBatch = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleRefresh = () => {
    fetchJobs();
  };

  const getTotalSummary = () => {
    if (!jobsData?.batches) return null;
    
    return jobsData.batches.reduce(
      (acc, batch) => ({
        total: acc.total + batch.summary.total,
        pending: acc.pending + batch.summary.pending,
        processing: acc.processing + batch.summary.processing,
        completed: acc.completed + batch.summary.completed,
        failed: acc.failed + batch.summary.failed,
      }),
      { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    );
  };

  const totalSummary = getTotalSummary();

  return (
    <Box>
      {/* Jobs Overview */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Processing Jobs Overview
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {totalSummary && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Total Jobs: {totalSummary.total} across {jobsData?.batches?.length || 0} batches
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Chip
                size="small"
                label={`${totalSummary.completed} Completed`}
                color="success"
                variant="outlined"
              />
              {totalSummary.processing > 0 && (
                <Chip
                  size="small"
                  label={`${totalSummary.processing} Processing`}
                  color="info"
                  variant="outlined"
                />
              )}
              {totalSummary.pending > 0 && (
                <Chip
                  size="small"
                  label={`${totalSummary.pending} Pending`}
                  color="warning"
                  variant="outlined"
                />
              )}
              {totalSummary.failed > 0 && (
                <Chip
                  size="small"
                  label={`${totalSummary.failed} Failed`}
                  color="error"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Job Batches */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Job Batches
        </Typography>

        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {jobsData && !loading && (
          <>
            {(jobsData.batches?.length || 0) === 0 ? (
              <Alert severity="info">
                No processing jobs found for this library. Jobs will appear here when you add resources to this library.
              </Alert>
            ) : (
              jobsData.batches?.map((batch, index) => (
                <Accordion key={batch.jobId} defaultExpanded={index === 0}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="subtitle1">
                        Batch {index + 1}: {formatDate(batch.createdAt)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip
                          size="small"
                          label={`Total: ${batch.summary.total}`}
                          variant="outlined"
                        />
                        {batch.summary.completed > 0 && (
                          <Chip
                            size="small"
                            label={`Completed: ${batch.summary.completed}`}
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {batch.summary.processing > 0 && (
                          <Chip
                            size="small"
                            label={`Processing: ${batch.summary.processing}`}
                            color="info"
                            variant="outlined"
                          />
                        )}
                        {batch.summary.failed > 0 && (
                          <Chip
                            size="small"
                            label={`Failed: ${batch.summary.failed}`}
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      <Box sx={{ mb: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleViewBatch(batch.jobId)}
                        >
                          View Batch Details & Actions
                        </Button>
                      </Box>
                      <Divider sx={{ mb: 2 }} />
                      
                      {/* Individual Jobs */}
                      <Typography variant="subtitle2" gutterBottom>
                        Individual Jobs:
                      </Typography>
                      {batch.jobs.map((job) => (
                        <Box
                          key={job.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            mb: 1,
                            p: 2,
                            bgcolor: 'background.default',
                            borderRadius: 1,
                          }}
                        >
                          <Chip
                            size="small"
                            label={job.status}
                            color={getStatusColor(job.status)}
                          />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {job.sourceUrl}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {job.scrapeType}
                          </Typography>
                          {job.processedAt && (
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(job.processedAt)}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default JobsTab;