import React, { useState } from 'react';
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
import { useStartCrawl } from '../hooks/mutations/useStartCrawl';

const AddSourcePage = () => {
  const [libraryName, setLibraryName] = useState('');
  const [libraryDescription, setLibraryDescription] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const navigate = useNavigate();

  const { mutate: startCrawl, isPending: isLoading, error } = useStartCrawl();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    startCrawl(
      {
        libraryName,
        libraryDescription,
        startUrl,
        scrapeType: 'documentation',
      },
      {
        onSuccess: (data) => {
          navigate(`/jobs/${data.jobId}`);
        },
      }
    );
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
            {error.message}
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
