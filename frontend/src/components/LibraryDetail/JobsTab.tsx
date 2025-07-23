import React from 'react';
import {
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import JobBatchAccordion from './JobBatchAccordion';
import { useLibraryJobs } from '../../hooks/queries/useLibraryJobs';

interface JobsTabProps {
  libraryId: string;
  onJobsUpdate?: () => void;
}

const JobsTab: React.FC<JobsTabProps> = ({ libraryId, onJobsUpdate }) => {
  const { data: jobsData, isLoading, error } = useLibraryJobs(libraryId);

  return (
    <Box>
      {/* Job Batches */}
      <Box>
        {isLoading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error instanceof Error ? error.message : 'Failed to fetch jobs'}
          </Alert>
        )}

        {jobsData && !isLoading && (
          <>
            {(jobsData.batches?.length || 0) === 0 ? (
              <Alert severity="info">
                No processing jobs found for this library. Jobs will appear here when you add resources to this library.
              </Alert>
            ) : (
              jobsData.batches?.map((batch, index) => (
                <JobBatchAccordion
                  key={batch.jobId}
                  batch={batch}
                  index={index}
                  defaultExpanded={index === 0}
                  onUpdate={onJobsUpdate}
                />
              ))
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default JobsTab;