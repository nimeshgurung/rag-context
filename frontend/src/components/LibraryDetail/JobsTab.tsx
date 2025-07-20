import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { getAllJobsForLibrary } from '../../services/api';
import JobBatchAccordion from './JobBatchAccordion';

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



  return (
    <Box>



      {/* Job Batches */}
      <Box>
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