import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box,
  FormHelperText,
  CircularProgress,
} from '@mui/material';
import { addLibraryResource } from '../services/api';
import { useNavigate } from 'react-router-dom';
import type { DocumentationSource } from '../../../src/lib/types';

interface AddResourceModalProps {
  open: boolean;
  onClose: () => void;
  libraryId: string;
  libraryName: string;
}

const AddResourceModal: React.FC<AddResourceModalProps> = ({
  open,
  onClose,
  libraryId,
  libraryName,
}) => {
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState<'web-scrape' | 'api-spec'>('web-scrape');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Web scrape fields
  const [url, setUrl] = useState('');
  const [scrapeType, setScrapeType] = useState<'code' | 'documentation'>('code');
  const [contentSelector, setContentSelector] = useState('');
  const [codeSelector, setCodeSelector] = useState('');

  // API spec fields
  const [specName, setSpecName] = useState('');
  const [specDescription, setSpecDescription] = useState('');
  const [specContent, setSpecContent] = useState('');

  const resetForm = () => {
    setSourceType('web-scrape');
    setUrl('');
    setScrapeType('code');
    setContentSelector('');
    setCodeSelector('');
    setSpecName('');
    setSpecDescription('');
    setSpecContent('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      let source: DocumentationSource;

      if (sourceType === 'web-scrape') {
        if (!url) {
          setError('URL is required');
          setLoading(false);
          return;
        }

        source = {
          type: 'web-scrape',
          name: libraryName, // Use the existing library name
          description: `Additional resource for ${libraryName}`,
          startUrl: url,
          config: {
            scrapeType,
            contentSelector: contentSelector || undefined,
            codeSelector: codeSelector || undefined,
            maxDepth: 3,
          },
        };
      } else {
        if (!specName || !specContent) {
          setError('Name and content are required for API spec');
          setLoading(false);
          return;
        }

        source = {
          type: 'api-spec',
          name: specName,
          description: specDescription || `API spec for ${libraryName}`,
          sourceType: 'text',
          content: specContent,
        };
      }

      const response = await addLibraryResource(libraryId, source);
      
      // Navigate to job status page
      navigate(`/jobs/${response.jobId}`);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add resource');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Resource to {libraryName}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Resource Type</InputLabel>
            <Select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as 'web-scrape' | 'api-spec')}
              label="Resource Type"
            >
              <MenuItem value="web-scrape">Web URL</MenuItem>
              <MenuItem value="api-spec">API Specification</MenuItem>
            </Select>
          </FormControl>

          {sourceType === 'web-scrape' ? (
            <>
              <TextField
                fullWidth
                label="URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                margin="normal"
                required
                helperText="The URL to crawl for documentation or code examples"
              />
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Scrape Type</InputLabel>
                <Select
                  value={scrapeType}
                  onChange={(e) => setScrapeType(e.target.value as 'code' | 'documentation')}
                  label="Scrape Type"
                >
                  <MenuItem value="code">Code Examples</MenuItem>
                  <MenuItem value="documentation">Documentation</MenuItem>
                </Select>
                <FormHelperText>
                  Choose 'Code Examples' for code snippets or 'Documentation' for general docs
                </FormHelperText>
              </FormControl>

              {scrapeType === 'code' && (
                <>
                  <TextField
                    fullWidth
                    label="Content Selector (Optional)"
                    value={contentSelector}
                    onChange={(e) => setContentSelector(e.target.value)}
                    margin="normal"
                    helperText="CSS selector for main content (e.g., 'main', '.content')"
                  />
                  
                  <TextField
                    fullWidth
                    label="Code Selector (Optional)"
                    value={codeSelector}
                    onChange={(e) => setCodeSelector(e.target.value)}
                    margin="normal"
                    helperText="CSS selector for code blocks (default: 'pre > code')"
                  />
                </>
              )}
            </>
          ) : (
            <>
              <TextField
                fullWidth
                label="Spec Name"
                value={specName}
                onChange={(e) => setSpecName(e.target.value)}
                margin="normal"
                required
                helperText="A name for this API specification"
              />
              
              <TextField
                fullWidth
                label="Description (Optional)"
                value={specDescription}
                onChange={(e) => setSpecDescription(e.target.value)}
                margin="normal"
                helperText="Brief description of the API"
              />
              
              <TextField
                fullWidth
                label="API Specification (JSON/YAML)"
                value={specContent}
                onChange={(e) => setSpecContent(e.target.value)}
                margin="normal"
                multiline
                rows={10}
                required
                helperText="Paste your OpenAPI/Swagger specification here"
              />
            </>
          )}

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Adding...' : 'Add Resource'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddResourceModal;