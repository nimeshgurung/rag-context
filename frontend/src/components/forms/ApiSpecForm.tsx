import React from 'react';
import {
  Box,
  TextField,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Typography,
} from '@mui/material';
import { useApiSpecForm } from '../../hooks/useApiSpecForm';

interface ApiSpecFormProps {
  formData: ReturnType<typeof useApiSpecForm>;
  hideLibraryFields?: boolean;
}

const ApiSpecForm: React.FC<ApiSpecFormProps> = ({ formData, hideLibraryFields = false }) => {
  const {
    libraryName,
    description,
    uploadType,
    file,
    textContent,
    setLibraryName,
    setDescription,
    setUploadType,
    setFile,
    setTextContent,
  } = formData;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

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

      {hideLibraryFields && (
        <>
          <TextField
            label="Spec Name (Optional)"
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            size="small"
            helperText="Give this API spec a name for identification"
          />
          <TextField
            label="Spec Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            size="small"
            helperText="Brief description of what this API spec covers"
          />
        </>
      )}

      <FormControl component="fieldset" sx={{ m: 1 }}>
        <FormLabel component="legend">Source</FormLabel>
        <RadioGroup
          row
          value={uploadType}
          onChange={(e) => setUploadType(e.target.value as 'file' | 'text')}
        >
          <FormControlLabel
            value="file"
            control={<Radio />}
            label="File Upload"
          />
          <FormControlLabel
            value="text"
            control={<Radio />}
            label="Paste Text"
          />
        </RadioGroup>
      </FormControl>

      {uploadType === 'file' ? (
        <Box sx={{ m: 1 }}>
          <Button variant="contained" component="label">
            Upload File
            <input
              type="file"
              hidden
              onChange={handleFileChange}
              accept=".json,.yaml,.yml"
            />
          </Button>
          {file && (
            <Typography sx={{ display: 'inline', ml: 2 }}>
              {file.name}
            </Typography>
          )}
        </Box>
      ) : (
        <TextField
          label="API Specification Content"
          multiline
          rows={10}
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
        />
      )}
    </Box>
  );
};

export default ApiSpecForm;
