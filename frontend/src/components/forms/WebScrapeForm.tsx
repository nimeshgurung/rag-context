import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import { useWebScrapeForm } from '../../hooks/useWebScrapeForm';

interface WebScrapeFormProps {
  formData: ReturnType<typeof useWebScrapeForm>;
}

const WebScrapeForm: React.FC<WebScrapeFormProps> = ({ formData }) => {
  const {
    libraryName,
    description,
    startUrl,
    contentSelector,
    codeSelector,
    preExecutionSteps,
    maxDepth,
    scrapeType,
    customEnrichmentPrompt,
    setLibraryName,
    setDescription,
    setStartUrl,
    setContentSelector,
    setCodeSelector,
    setPreExecutionSteps,
    setMaxDepth,
    setScrapeType,
    setCustomEnrichmentPrompt,
  } = formData;

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
          <FormControlLabel
            value="code"
            control={<Radio />}
            label="Code-focused"
          />
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
          setMaxDepth(e.target.value === '' ? '' : parseInt(e.target.value, 10))
        }
        size="small"
      />
      {scrapeType === 'code' && (
        <TextField
          label="Custom Enrichment Instructions"
          value={customEnrichmentPrompt}
          onChange={(e) => setCustomEnrichmentPrompt(e.target.value)}
          helperText="Additional instructions for synthesizing code snippets (e.g., 'Focus on React hooks', 'Include TypeScript types')"
          multiline
          rows={3}
          size="small"
        />
      )}
    </Box>
  );
};

export default WebScrapeForm;
