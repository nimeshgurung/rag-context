import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { startCrawl } from '../services/api';

const AddSourcePage = () => {
  const [libraryName, setLibraryName] = useState('');
  const [libraryDescription, setLibraryDescription] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await startCrawl({
        libraryName,
        libraryDescription,
        startUrl,
      });
      navigate(`/jobs/${result.jobId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start crawl job.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Add New Documentation Source
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
        <TextField
          margin="normal"
          required
          fullWidth
          id="libraryName"
          label="Library Name"
          name="libraryName"
          autoFocus
          value={libraryName}
          onChange={(e) => setLibraryName(e.target.value)}
        />
        <TextField
          margin="normal"
          fullWidth
          id="libraryDescription"
          label="Library Description"
          name="libraryDescription"
          multiline
          rows={3}
          value={libraryDescription}
          onChange={(e) => setLibraryDescription(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          id="startUrl"
          label="Start URL for Crawling"
          name="startUrl"
          value={startUrl}
          onChange={(e) => setStartUrl(e.target.value)}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Start Crawling'}
        </Button>
      </Box>
    </Container>
  );
};

export default AddSourcePage;