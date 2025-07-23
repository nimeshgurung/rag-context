import { CheckCircle, Error, Schedule, HourglassEmpty } from '@mui/icons-material';

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle color="success" fontSize="small" />;
    case 'failed':
      return <Error color="error" fontSize="small" />;
    case 'processing':
      return <HourglassEmpty color="info" fontSize="small" />;
    default:
      return <Schedule color="warning" fontSize="small" />;
  }
};

export const getStatusColor = (status: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'processing':
      return 'info';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};