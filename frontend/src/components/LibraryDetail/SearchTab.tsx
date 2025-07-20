import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { fetchLibraryDocumentation } from '../../services/api';

interface SearchTabProps {
  libraryId: string;
}

const SearchTab: React.FC<SearchTabProps> = ({ libraryId }) => {
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Load default documentation when tab first loads
    if (libraryId && !hasSearched) {
      fetchDocs(libraryId);
    }
  }, [libraryId, hasSearched]);

  const fetchDocs = async (libraryId: string, searchTopic?: string) => {
    try {
      setLoading(true);
      const docs = await fetchLibraryDocumentation(libraryId, searchTopic);
      setDocumentation(docs);
      setHasSearched(true);
    } catch (error) {
      console.error('Failed to fetch documentation', error);
      setDocumentation('Failed to load documentation.');
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (libraryId) {
      fetchDocs(libraryId, topic);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box>
      {/* Search Interface */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Documentation
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            variant="outlined"
            label="Search Topic"
            placeholder="e.g. data fetching, routing, middleware, authentication..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyPress={handleKeyPress}
            size="small"
            helperText="Leave empty to get general documentation overview"
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading}
            sx={{ minWidth: '120px', height: '40px' }}
          >
            {loading ? <CircularProgress size={20} /> : 'Search'}
          </Button>
        </Box>
      </Paper>

      {/* Results */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Documentation Results
        </Typography>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : !hasSearched ? (
          <Alert severity="info">
            Enter a search topic above or click "Search" to load documentation.
          </Alert>
        ) : documentation ? (
          <TextField
            fullWidth
            multiline
            value={documentation}
            InputProps={{
              readOnly: true,
              style: {
                fontFamily: 'monospace',
                fontSize: '14px',
              },
            }}
            rows={25}
            variant="outlined"
          />
        ) : (
          <Alert severity="warning">
            No documentation found. The library may not have been indexed yet.
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default SearchTab;