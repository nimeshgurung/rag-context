import React from 'react';
import { TableRow, TableCell, Checkbox, Box, IconButton } from '@mui/material';
import { PlayArrow, Delete, Refresh } from '@mui/icons-material';
import { StatusChip } from './StatusChip';
import { SourceDisplay } from './SourceDisplay';
import type { JobItem } from '../../../types';

interface JobRowProps {
  job: JobItem;
  isSelected: boolean;
  shouldDisableProcessing?: boolean;
  onToggleSelection: () => void;
  onProcess: () => void;
  onDelete: () => void;
}

export const JobRow: React.FC<JobRowProps> = ({
  job,
  isSelected,
  shouldDisableProcessing = false,
  onToggleSelection,
  onProcess,
  onDelete,
}) => (
  <TableRow hover>
    <TableCell padding="checkbox">
      <Checkbox checked={isSelected} onChange={onToggleSelection} />
    </TableCell>
    <TableCell>
      <SourceDisplay
        source={job.source}
        sourceType={job.sourceType}
        originUrl={job.originUrl}
      />
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
            disabled={shouldDisableProcessing}
            title="Process"
          >
            <PlayArrow fontSize="small" />
          </IconButton>
        )}
        {(job.status === 'completed' || job.status === 'failed') && (
          <IconButton
            size="small"
            onClick={onProcess}
            disabled={shouldDisableProcessing}
            title="Reprocess"
            color="primary"
          >
            <Refresh fontSize="small" />
          </IconButton>
        )}
        <IconButton
          size="small"
          onClick={onDelete}
          disabled={shouldDisableProcessing || job.status === 'processing'}
          title="Delete"
          color="error"
        >
          <Delete fontSize="small" />
        </IconButton>
      </Box>
    </TableCell>
  </TableRow>
);