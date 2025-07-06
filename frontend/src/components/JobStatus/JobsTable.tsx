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
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import type { Job } from '../../types';

interface JobsTableProps {
  jobs: Job[];
  selectedJobIds: Set<number>;
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectClick: (id: number) => void;
  onProcessSingle: (id: number) => void;
  onDelete: (id: number) => void;
  processingJobId: number | null;
  isActionPending: boolean;
}

const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  selectedJobIds,
  onSelectAllClick,
  onSelectClick,
  onProcessSingle,
  onDelete,
  processingJobId,
  isActionPending,
}) => {
  return (
    <TableContainer component={Paper}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={
                  selectedJobIds.size > 0 &&
                  selectedJobIds.size < jobs.length
                }
                checked={
                  jobs.length > 0 &&
                  selectedJobIds.size === jobs.length
                }
                onChange={onSelectAllClick}
              />
            </TableCell>
            <TableCell>Source URL</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              hover
              onClick={() => onSelectClick(job.id)}
              role="checkbox"
              aria-checked={selectedJobIds.has(job.id)}
              tabIndex={-1}
              key={job.id}
              selected={selectedJobIds.has(job.id)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell padding="checkbox">
                <Checkbox
                  color="primary"
                  checked={selectedJobIds.has(job.id)}
                />
              </TableCell>
              <TableCell sx={{ maxWidth: 400, wordBreak: 'break-all' }}>
                {job.sourceUrl}
              </TableCell>
              <TableCell>{job.status}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    color="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProcessSingle(job.id);
                    }}
                    disabled={
                      processingJobId === job.id ? false : isActionPending
                    }
                  >
                    {processingJobId === job.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      'Process'
                    )}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(job.id);
                    }}
                    disabled={isActionPending}
                  >
                    Delete
                  </Button>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default JobsTable;