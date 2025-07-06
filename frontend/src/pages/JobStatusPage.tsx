import React from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  LinearProgress,
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
                <LinearProgress variant="determinate" value={progress} />
              </Box>
              <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" color="text.secondary">
                  {`${Math.round(progress)}%`}
                </Typography>
              </Box>
            </Box>
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
            onReprocess={handleReprocess}
            onProcessSingle={handleProcessSingle}
            onDelete={handleDelete}
            isReprocessing={isReprocessing}
            processingJobId={processingJobId}
            isActionPending={isActionPending}
          />
        </>
      )}
    </Container>
  );
};

export default JobStatusPage;