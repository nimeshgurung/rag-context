import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Typography,
  CircularProgress
} from '@mui/material';
import { JobRow } from './JobRow';
import type { JobItem } from '../../../types';

interface JobsTableProps {
  jobs: JobItem[];
  selectedIds: Set<number>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  isLoading: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleSelection: (id: number) => void;
  onProcessJob: (id: number) => void;
  onDeleteJob: (id: number) => void;
}

export const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  selectedIds,
  isAllSelected,
  isIndeterminate,
  isLoading,
  onSelectAll,
  onClearSelection,
  onToggleSelection,
  onProcessJob,
  onDeleteJob,
}) => (
  <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell padding="checkbox">
            <Checkbox
              indeterminate={isIndeterminate}
              checked={isAllSelected}
              onChange={(e) => e.target.checked ? onSelectAll() : onClearSelection()}
            />
          </TableCell>
          <TableCell>URL</TableCell>

          <TableCell>Status</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} align="center">
              <CircularProgress size={24} />
            </TableCell>
          </TableRow>
        ) : jobs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} align="center">
              <Typography variant="body2" color="text.secondary">
                No jobs found
              </Typography>
            </TableCell>
          </TableRow>
        ) : (
          jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              isSelected={selectedIds.has(job.id)}
              onToggleSelection={() => onToggleSelection(job.id)}
              onProcess={() => onProcessJob(job.id)}
              onDelete={() => onDeleteJob(job.id)}
            />
          ))
        )}
      </TableBody>
    </Table>
  </TableContainer>
);