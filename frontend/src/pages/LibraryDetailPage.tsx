import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, TextField, Button, Paper, CircularProgress } from '@mui/material';
import Markdown from 'markdown-to-jsx';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchLibraryDocumentation } from '../services/api';

const CodeSnippet = ({ className, children }: {className?: string, children: React.ReactNode}) => {
  const match = /lang-(\w+)/.exec(className || '');
  return match ? (
    <SyntaxHighlighter
      style={vscDarkPlus}
      language={match[1]}
      PreTag="div"
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className={className}>{children}</code>
  );
};

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

      <Box sx={{ display: 'flex', mb: 2, gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Show docs for... e.g. data fetching, routing, middleware"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <Button variant="contained" onClick={handleSearch}>
          Show Results
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <CircularProgress />
        ) : (
          <Markdown
            options={{
              overrides: {
                code: {
                  component: CodeSnippet,
                },
              },
            }}
          >
            {documentation}
          </Markdown>
        )}
      </Paper>
    </Box>
  );
};

export default LibraryDetailPage;