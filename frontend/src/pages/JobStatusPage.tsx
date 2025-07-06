import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import { useJobStatus } from '../components/JobStatus/useJobStatus';
import JobSummary from '../components/JobStatus/JobSummary';
import JobActions from '../components/JobStatus/JobActions';
import JobsTable from '../components/JobStatus/JobsTable';

const JobStatusPage = () => {
  const {
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
  } = useJobStatus();

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

      {status && (
        <>
          <Box sx={{ my: 2 }}>
            <Typography variant="h6">Summary</Typography>
            <JobSummary summary={status.summary} />
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
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
            {isProcessing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="primary">
                  Processing jobs in the background...
                </Typography>
                <Chip
                  label={`${status.summary.processing} processing`}
                  color="info"
                  size="small"
                />
                <Chip
                  label={`${status.summary.pending} pending`}
                  color="warning"
                  size="small"
                />
              </Box>
            )}
          </Box>
          <JobActions
            filterText={filterText}
            onFilterChange={handleFilterChange}
            onProcessSelected={handleProcessSelected}
            onDeleteSelected={handleDeleteSelected}
            onProcessAll={handleProcessAll}
            selectedJobIds={selectedJobIds}
            isActionPending={isActionPending}
            isProcessing={isProcessing}
          />
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
        </>
      )}
    </Container>
  );
};

export default JobStatusPage;