import React from 'react';
import {
  Box,
  TextField,
  Typography,
} from '@mui/material';
import { useWebScrapeForm } from '../../hooks/useWebScrapeForm';

interface WebScrapeFormProps {
  formData: ReturnType<typeof useWebScrapeForm>;
  hideLibraryFields?: boolean;
}

const WebScrapeForm: React.FC<WebScrapeFormProps> = ({ formData, hideLibraryFields = false }) => {
  const {
    libraryName,
    description,
    startUrl,
    preExecutionSteps,
    additionalInstructions,
    setLibraryName,
    setDescription,
    setStartUrl,
    setPreExecutionSteps,
    setAdditionalInstructions,
  } = formData;

  return (
    <Box
      component="form"
      noValidate
      autoComplete="off"
      sx={{ '& .MuiTextField-root': { m: 1, width: '95%' } }}
    >
      {!hideLibraryFields && (
        <>
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
        </>
      )}
      <TextField
        required
        label="Start URL"
        value={startUrl}
        onChange={(e) => setStartUrl(e.target.value)}
        size="small"
        helperText={hideLibraryFields ? "The URL to crawl for additional documentation or code examples" : undefined}
      />

      <Typography variant="subtitle2" sx={{ m: 1, mt: 2 }}>
        Advanced (Optional)
      </Typography>
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
        label="Additional Instructions"
        value={additionalInstructions}
        onChange={(e) => setAdditionalInstructions(e.target.value)}
        helperText="Additional instructions for processing documentation (e.g., 'Focus on React hooks', 'Include TypeScript types')"
        multiline
        rows={3}
        size="small"
      />
    </Box>
  );
};

export default WebScrapeForm;
