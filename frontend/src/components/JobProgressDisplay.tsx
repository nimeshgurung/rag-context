import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';

interface JobProgressDisplayProps {
  progress: string[];
}

const JobProgressDisplay: React.FC<JobProgressDisplayProps> = ({ progress }) => {
  return (
    <Box>
      <Typography variant="h6" component="h2">
        Processing...
      </Typography>
      <CircularProgress sx={{ my: 2 }} />
      <Box
        sx={{
          maxHeight: 300,
          overflowY: 'auto',
          border: '1px solid #ccc',
          p: 1,
          mt: 1,
          borderRadius: '4px',
        }}
      >
        {progress.map((msg, index) => (
          <Typography key={index} variant="body2">
            {msg}
          </Typography>
        ))}
      </Box>
    </Box>
  );
};

export default JobProgressDisplay;