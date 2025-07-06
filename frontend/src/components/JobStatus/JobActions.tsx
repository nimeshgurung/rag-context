import React from 'react';
import { Box, Button, TextField, CircularProgress } from '@mui/material';

interface JobActionsProps {
  filterText: string;
  onFilterChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onProcessSelected: () => void;
  onDeleteSelected: () => void;
  onProcessAll: () => void;
  selectedJobIds: Set<number>;
  isActionPending: boolean;
  isProcessing: boolean;
}

const JobActions: React.FC<JobActionsProps> = ({
  filterText,
  onFilterChange,
  onProcessSelected,
  onDeleteSelected,
  onProcessAll,
  selectedJobIds,
  isActionPending,
  isProcessing,
}) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <TextField
        label="Filter by URL"
        value={filterText}
        onChange={onFilterChange}
        variant="outlined"
        size="small"
        sx={{ width: '40%' }}
      />
      <Box>
        <Button
          variant="contained"
          onClick={onProcessSelected}
          disabled={selectedJobIds.size === 0 || isActionPending}
          sx={{ mr: 1 }}
        >
          Process Selected
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onDeleteSelected}
          disabled={selectedJobIds.size === 0 || isActionPending}
          sx={{ mr: 1 }}
        >
          Delete Selected
        </Button>
        <Button
          variant="contained"
          onClick={onProcessAll}
          disabled={isActionPending}
          startIcon={isProcessing ? <CircularProgress size={16} /> : null}
        >
          {isProcessing ? 'Processing All Jobs...' : 'Process All'}
        </Button>
      </Box>
    </Box>
  );
};

export default JobActions;
