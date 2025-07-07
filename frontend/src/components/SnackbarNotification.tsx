import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import type { AlertColor } from '@mui/material';

interface SnackbarNotificationProps {
  open: boolean;
  message: string;
  severity: AlertColor;
  onClose: () => void;
  autoHideDuration?: number;
}

const SnackbarNotification: React.FC<SnackbarNotificationProps> = ({
  open,
  message,
  severity,
  onClose,
  autoHideDuration = 6000,
}) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default SnackbarNotification;
