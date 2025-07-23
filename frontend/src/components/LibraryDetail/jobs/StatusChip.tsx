import React from 'react';
import { Box, Chip } from '@mui/material';
import { getStatusIcon, getStatusColor } from './helpers';

interface StatusChipProps {
  status: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    {getStatusIcon(status)}
    <Chip
      label={status}
      size="small"
      color={getStatusColor(status)}
    />
  </Box>
);