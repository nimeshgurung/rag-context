import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
} from '@mui/material';
import { fetchLibraryDocumentation } from '../services/api';

const LibraryDetailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('libraryid');
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('');

  useEffect(() => {
    if (id) {
      fetchDocs(id);
    }
  }, [id]);

  const fetchDocs = async (libraryId: string, searchTopic?: string) => {
    try {
      setLoading(true);
      const docs = await fetchLibraryDocumentation(libraryId, searchTopic);
      setDocumentation(docs);
    } catch (error) {
      console.error('Failed to fetch documentation', error);
      setDocumentation('Failed to load documentation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (id) {
      fetchDocs(id, topic);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h4">{id}</Typography>
      </Paper>

      <Box sx={{ display: 'flex', mb: 2, gap: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Show docs for... e.g. data fetching, routing, middleware"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          size="small"
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          size="small"
          sx={{ minWidth: '160px' }}
        >
          Show Results
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <CircularProgress />
        ) : (
          <TextField
            fullWidth
            multiline
            value={documentation}
            InputProps={{
              readOnly: true,
              style: {
                fontFamily: 'monospace',
              },
            }}
            rows={30}
          />
        )}
      </Paper>
    </Box>
  );
};

export default LibraryDetailPage;
