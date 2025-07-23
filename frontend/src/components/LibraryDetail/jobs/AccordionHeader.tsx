import React from 'react';
import { Box, Typography, Chip, LinearProgress } from '@mui/material';
import { formatDate } from './helpers';
import type { JobBatch } from '../../../types';

interface AccordionHeaderProps {
  batch: JobBatch;
  index: number;
  progressPercent: number;
}

export const AccordionHeader: React.FC<AccordionHeaderProps> = ({ batch, index, progressPercent }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
    <Typography sx={{ flexGrow: 1 }}>
      Batch #{index + 1} - {formatDate(batch.createdAt)}
    </Typography>

    <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
      <Chip label={`Total: ${batch.summary.total}`} size="small" />
      {batch.summary.pending > 0 && (
        <Chip label={`Pending: ${batch.summary.pending}`} color="warning" size="small" />
      )}
      {batch.summary.processing > 0 && (
        <Chip label={`Processing: ${batch.summary.processing}`} color="info" size="small" />
      )}
      {batch.summary.completed > 0 && (
        <Chip label={`Completed: ${batch.summary.completed}`} color="success" size="small" />
      )}
      {batch.summary.failed > 0 && (
        <Chip label={`Failed: ${batch.summary.failed}`} color="error" size="small" />
      )}
    </Box>

    {progressPercent > 0 && (
      <Box sx={{ width: 100, mr: 2 }}>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          color={batch.summary.failed > 0 ? 'error' : 'primary'}
        />
      </Box>
    )}
  </Box>
);