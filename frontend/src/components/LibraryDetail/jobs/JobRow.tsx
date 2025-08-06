import React from 'react';
import { TableRow, TableCell, Checkbox, Typography, Chip, Box, IconButton } from '@mui/material';
import { PlayArrow, Delete, Refresh } from '@mui/icons-material';
import { StatusChip } from './StatusChip';
import type { JobItem } from '../../../types';

interface JobRowProps {
  job: JobItem;
  isSelected: boolean;
  onToggleSelection: () => void;
  onProcess: () => void;
  onDelete: () => void;
}

export const JobRow: React.FC<JobRowProps> = ({
  job,
  isSelected,
  onToggleSelection,
  onProcess,
  onDelete,
}) => (
  <TableRow hover>
    <TableCell padding="checkbox">
      <Checkbox checked={isSelected} onChange={onToggleSelection} />
    </TableCell>
    <TableCell>
      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
        {job.sourceUrl}
      </Typography>
    </TableCell>

    <TableCell>
      <StatusChip status={job.status} />
    </TableCell>
    <TableCell>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {job.status === 'pending' && (
          <IconButton
            size="small"
            onClick={onProcess}
            title="Process"
          >
            <PlayArrow fontSize="small" />
          </IconButton>
        )}
        {(job.status === 'completed' || job.status === 'failed') && (
          <IconButton
            size="small"
            onClick={onProcess}
            title="Reprocess"
            color="primary"
          >
            <Refresh fontSize="small" />
          </IconButton>
        )}
        <IconButton
          size="small"
          onClick={onDelete}
          disabled={job.status === 'processing'}
          title="Delete"
          color="error"
        >
          <Delete fontSize="small" />
        </IconButton>
      </Box>
    </TableCell>
  </TableRow>
);