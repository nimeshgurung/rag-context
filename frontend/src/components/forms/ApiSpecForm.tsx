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
  onSubmit: (formData: ReturnType<typeof useApiSpecForm>) => void;
  onCancel: () => void;
}

const ApiSpecForm: React.FC<ApiSpecFormProps> = ({ onSubmit, onCancel }) => {
  const formData = useApiSpecForm();
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

export default ApiSpecForm;