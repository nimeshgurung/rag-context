import React from 'react';
import { Box, Button, TextField, CircularProgress } from '@mui/material';
import { PlayArrow, Delete, Refresh } from '@mui/icons-material';

interface ActionBarProps {
  filterText: string;
  setFilterText: (text: string) => void;
  selectedIds: Set<number>;
  isProcessing: boolean;
  hasPendingJobs: boolean;
  hasSelectedPendingJobs?: boolean;
  hasSelectedCompletedOrFailedJobs?: boolean;
  onProcessSelected: () => void;
  onDeleteSelected: () => void;
  onProcessAll: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  filterText,
  setFilterText,
  selectedIds,
  isProcessing,
  hasPendingJobs,
  hasSelectedPendingJobs = false,
  hasSelectedCompletedOrFailedJobs = false,
  onProcessSelected,
  onDeleteSelected,
  onProcessAll,
}) => {
  // Determine button text and icon based on selection
  const getProcessButtonConfig = () => {
    if (hasSelectedPendingJobs && hasSelectedCompletedOrFailedJobs) {
      return { text: 'Process/Reprocess Selected', icon: <PlayArrow /> };
    } else if (hasSelectedCompletedOrFailedJobs) {
      return { text: 'Reprocess Selected', icon: <Refresh /> };
    } else {
      return { text: 'Process Selected', icon: <PlayArrow /> };
    }
  };

  const { text: processButtonText, icon: processButtonIcon } = getProcessButtonConfig();

  return (
    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <TextField
        size="small"
        placeholder="Filter by URL..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        sx={{ width: '40%' }}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        {selectedIds.size > 0 && (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={onProcessSelected}
              disabled={isProcessing}
              startIcon={processButtonIcon}
              color={hasSelectedCompletedOrFailedJobs ? 'primary' : 'inherit'}
            >
              {processButtonText} ({selectedIds.size})
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={onDeleteSelected}
              disabled={isProcessing}
              startIcon={<Delete />}
            >
              Delete Selected
            </Button>
          </>
        )}
        <Button
          variant="contained"
          size="small"
          onClick={onProcessAll}
          disabled={isProcessing || !hasPendingJobs}
          startIcon={isProcessing ? <CircularProgress size={16} /> : <PlayArrow />}
        >
          {isProcessing ? 'Processing...' : 'Process All Pending'}
        </Button>
      </Box>
    </Box>
  );
};