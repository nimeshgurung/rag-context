import React from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import { useWebScrapeForm } from '../../hooks/useWebScrapeForm';

interface WebScrapeFormProps {
  onSubmit: (formData: ReturnType<typeof useWebScrapeForm>) => void;
  onCancel: () => void;
}

const WebScrapeForm: React.FC<WebScrapeFormProps> = ({ onSubmit, onCancel }) => {
  const formData = useWebScrapeForm();
  const {
    libraryName,
    description,
    startUrl,
    contentSelector,
    codeSelector,
    preExecutionSteps,
    maxDepth,
    scrapeType,
    setLibraryName,
    setDescription,
    setStartUrl,
    setContentSelector,
    setCodeSelector,
    setPreExecutionSteps,
    setMaxDepth,
    setScrapeType,
  } = formData;

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Box
      component="form"
      noValidate
      autoComplete="off"
      sx={{ '& .MuiTextField-root': { m: 1, width: '95%' } }}
    >
      <TextField
        required
        label="Library Name"
        value={libraryName}
        onChange={(e) => setLibraryName(e.target.value)}
        size="small"
      />
      <TextField
        required
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        multiline
        rows={2}
        size="small"
      />
      <TextField
        required
        label="Start URL"
        value={startUrl}
        onChange={(e) => setStartUrl(e.target.value)}
        size="small"
      />
      <FormControl component="fieldset" sx={{ m: 1, width: '95%' }}>
        <FormLabel component="legend">Scrape Type</FormLabel>
        <RadioGroup
          row
          aria-label="scrape type"
          name="scrape-type"
          value={scrapeType}
          onChange={(e) =>
            setScrapeType(e.target.value as 'code' | 'documentation')
          }
        >
          <FormControlLabel value="code" control={<Radio />} label="Code-focused" />
          <FormControlLabel
            value="documentation"
            control={<Radio />}
            label="Documentation"
          />
        </RadioGroup>
      </FormControl>
      <Typography variant="subtitle2" sx={{ m: 1, mt: 2 }}>
        Advanced (Optional)
      </Typography>
      <TextField
        label="Content CSS Selector"
        value={contentSelector}
        onChange={(e) => setContentSelector(e.target.value)}
        helperText="e.g., main .content"
        size="small"
      />
      <TextField
        label="Code CSS Selector"
        value={codeSelector}
        onChange={(e) => setCodeSelector(e.target.value)}
        helperText="e.g., .code-block, pre code (default: pre > code)"
        size="small"
      />
      <TextField
        label="Pre-Execution Steps"
        value={preExecutionSteps}
        onChange={(e) => setPreExecutionSteps(e.target.value)}
        helperText="JavaScript code to execute before scraping (e.g., click buttons to reveal content)"
        multiline
        rows={3}
        size="small"
      />
      <TextField
        label="Max Crawl Depth"
        type="number"
        value={maxDepth}
        onChange={(e) =>
          setMaxDepth(
            e.target.value === '' ? '' : parseInt(e.target.value, 10),
          )
        }
        size="small"
      />
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} sx={{ mr: 1 }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit}>
          Submit
        </Button>
      </Box>
    </Box>
  );
};

export default WebScrapeForm;