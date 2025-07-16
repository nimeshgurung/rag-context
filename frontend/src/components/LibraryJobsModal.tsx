import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getAllJobsForLibrary } from '../services/api';
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

interface LibraryJobsModalProps {
  open: boolean;
  onClose: () => void;
  libraryId: string;
  libraryName: string;
}

const LibraryJobsModal: React.FC<LibraryJobsModalProps> = ({
  open,
  onClose,
  libraryId,
  libraryName,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobsData, setJobsData] = useState<JobsData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && libraryId) {
      fetchJobs();
    }
  }, [open, libraryId]);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllJobsForLibrary(libraryId);
      setJobsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

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
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="library-jobs-modal-title"
    >
      <DialogTitle id="library-jobs-modal-title">
        Jobs for {libraryName}
      </DialogTitle>
      <DialogContent>
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
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Total Jobs: {jobsData.totalJobs} across {jobsData.batches?.length || 0} batches
            </Typography>

            {(jobsData.batches?.length || 0) === 0 ? (
              <Alert severity="info">No jobs found for this library.</Alert>
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
                          View Batch Details
                        </Button>
                      </Box>
                      {batch.jobs.map((job) => (
                        <Box
                          key={job.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            mb: 1,
                            p: 1,
                            bgcolor: 'background.paper',
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
                        </Box>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LibraryJobsModal;