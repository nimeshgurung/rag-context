import React from 'react';
import { Grid, Paper, Typography } from '@mui/material';
import type { JobStatus } from '../../types';

interface JobSummaryProps {
  summary: JobStatus['summary'];
}

const JobSummary: React.FC<JobSummaryProps> = ({ summary }) => {
  return (
    <Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
      <Grid>
        <Paper sx={{ p: 2 }}>
          <Typography>Total: {summary.total}</Typography>
        </Paper>
      </Grid>
      <Grid>
        <Paper sx={{ p: 2, color: 'success.main' }}>
          <Typography>Completed: {summary.completed}</Typography>
        </Paper>
      </Grid>
      <Grid>
        <Paper sx={{ p: 2, color: 'error.main' }}>
          <Typography>Failed: {summary.failed}</Typography>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default JobSummary;