import React, { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  CircularProgress,
} from '@mui/material';
import { addDocumentationSource } from '../services/api';
import type { ApiSpecSource, WebScrapeSource } from '../../../src/lib/types';
import { useDialog } from '../context/DialogProvider';

interface AddDocsModalProps {
  open: boolean;
  onClose: () => void;
}

const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  border: '1px solid #000',
  boxShadow: 24,
  p: 4,
  borderRadius: '8px',
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AddDocsModal: React.FC<AddDocsModalProps> = ({ open, onClose }) => {
  const [value, setValue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const { showDialog } = useDialog();

  // API Spec State
  const [libraryName, setLibraryName] = useState('');
  const [apiSpecDescription, setApiSpecDescription] = useState('');
  const [uploadType, setUploadType] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');

  // Web Scrape State
  const [scrapeLibraryName, setScrapeLibraryName] = useState('');
  const [scrapeDescription, setScrapeDescription] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [contentSelector, setContentSelector] = useState('');
  const [linkSelector, setLinkSelector] = useState('');
  const [maxDepth, setMaxDepth] = useState<number | ''>('');

  useEffect(() => {
    if (!open) {
      // Reset state when modal closes
      setIsProcessing(false);
      setProgress([]);
      setLibraryName('');
      setApiSpecDescription('');
      setFile(null);
      setTextContent('');
      setScrapeLibraryName('');
      setScrapeDescription('');
      setStartUrl('');
      setContentSelector('');
      setLinkSelector('');
      setMaxDepth('');
    }
  }, [open]);

  const listenToJob = (jobId: string) => {
    const eventSource = new EventSource(
      `http://localhost:3001/api/jobs/${jobId}/events`,
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress((prev) => [...prev, data.message]);
      if (data.type === 'done' || data.type === 'error') {
        if (data.type === 'done') {
          window.dispatchEvent(new CustomEvent('library-added'));
        }
        eventSource.close();
        setTimeout(() => onClose(), 3000); // Close modal after 3s
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      setProgress((prev) => [...prev, 'Connection to server lost.']);
      eventSource.close();
    };
  };

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmitApiSpec = async () => {
    if (!libraryName || !apiSpecDescription) {
      showDialog(
        'Missing Information',
        'Library Name and Description are required.',
      );
      return;
    }

    const processAndSubmit = (content: string) => {
      const source: ApiSpecSource = {
        type: 'api-spec',
        name: libraryName,
        description: apiSpecDescription,
        sourceType: uploadType as 'file' | 'text',
        content,
      };
      setIsProcessing(true);
      setProgress(['Submitting API specification...']);
      addDocumentationSource(source)
        .then((res) => {
          if (res.jobId) {
            setProgress((prev) => [
              ...prev,
              'Processing started. Listening for updates...',
            ]);
            listenToJob(res.jobId);
          }
        })
        .catch((error) => {
          console.error('Failed to add API Spec source', error);
          setProgress(['Error submitting job.']);
          setTimeout(() => onClose(), 3000);
        });
    };

    if (uploadType === 'file' && file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        processAndSubmit(fileContent);
      };
      reader.onerror = (e) => {
        console.error('File reading failed', e);
        showDialog('Error', 'Failed to read file.');
      };
      reader.readAsText(file);
    } else if (uploadType === 'text' && textContent) {
      processAndSubmit(textContent);
    } else {
      showDialog(
        'Missing Information',
        'Please select a file or paste content.',
      );
    }
  };

  const handleSubmitWebScrape = async () => {
    if (!scrapeLibraryName || !scrapeDescription || !startUrl) {
      showDialog(
        'Missing Information',
        'Library Name, Description, and Start URL are required.',
      );
      return;
    }

    const source: WebScrapeSource = {
      type: 'web-scrape',
      name: scrapeLibraryName,
      description: scrapeDescription,
      startUrl,
      config: {
        contentSelector: contentSelector || undefined,
        linkSelector: linkSelector || undefined,
        maxDepth: maxDepth === '' ? undefined : Number(maxDepth),
      },
    };

    try {
      setIsProcessing(true);
      setProgress(['Submitting web scrape job...']);
      const res = await addDocumentationSource(source);
      if (res.jobId) {
        setProgress((prev) => [
          ...prev,
          'Processing started. Listening for updates...',
        ]);
        listenToJob(res.jobId);
      }
    } catch (error) {
      console.error('Failed to add Web Scrape source', error);
      setProgress(['Error submitting job.']);
      if (error instanceof Error) {
        showDialog('Error', `Error: ${error.message}`);
      } else {
        showDialog('Error', 'An unknown error occurred.');
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={isProcessing ? undefined : onClose}
      aria-labelledby="add-docs-modal-title"
      aria-describedby="add-docs-modal-description"
    >
      <Box sx={style}>
        {isProcessing ? (
          <Box>
            <Typography variant="h6" component="h2">
              Processing...
            </Typography>
            <CircularProgress sx={{ my: 2 }} />
            <Box
              sx={{
                maxHeight: 300,
                overflowY: 'auto',
                border: '1px solid #ccc',
                p: 1,
                mt: 1,
                borderRadius: '4px',
              }}
            >
              {progress.map((msg, index) => (
                <Typography key={index} variant="body2">
                  {msg}
                </Typography>
              ))}
            </Box>
          </Box>
        ) : (
          <>
            <Typography id="add-docs-modal-title" variant="h6" component="h2">
              Add New Documentation
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
              <Tabs
                value={value}
                onChange={handleChange}
                aria-label="add docs tabs"
              >
                <Tab label="API Specification" />
                <Tab label="Web Scrape" />
              </Tabs>
            </Box>
            <TabPanel value={value} index={0}>
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
                  value={apiSpecDescription}
                  onChange={(e) => setApiSpecDescription(e.target.value)}
                  multiline
                  rows={2}
                  size="small"
                />
                <FormControl component="fieldset" sx={{ m: 1 }}>
                  <FormLabel component="legend">Source</FormLabel>
                  <RadioGroup
                    row
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
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
                <Box
                  sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}
                >
                  <Button onClick={onClose} sx={{ mr: 1 }}>
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={handleSubmitApiSpec}>
                    Submit
                  </Button>
                </Box>
              </Box>
            </TabPanel>
            <TabPanel value={value} index={1}>
              <Box
                component="form"
                noValidate
                autoComplete="off"
                sx={{ '& .MuiTextField-root': { m: 1, width: '95%' } }}
              >
                <TextField
                  required
                  label="Library Name"
                  value={scrapeLibraryName}
                  onChange={(e) => setScrapeLibraryName(e.target.value)}
                  size="small"
                />
                <TextField
                  required
                  label="Description"
                  value={scrapeDescription}
                  onChange={(e) => setScrapeDescription(e.target.value)}
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
                  label="Navigation Link Selector"
                  value={linkSelector}
                  onChange={(e) => setLinkSelector(e.target.value)}
                  helperText="e.g., .sidebar a"
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
                <Box
                  sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}
                >
                  <Button onClick={onClose} sx={{ mr: 1 }}>
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={handleSubmitWebScrape}>
                    Submit
                  </Button>
                </Box>
              </Box>
            </TabPanel>
          </>
        )}
      </Box>
    </Modal>
  );
};

export default AddDocsModal;
