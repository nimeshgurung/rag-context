import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
} from '@mui/material';

import TabPanel from './TabPanel';
import ApiSpecFormBody from './forms/ApiSpecFormBody';
import WebScrapeFormBody from './forms/WebScrapeFormBody';
import GitlabRepoFormBody from './forms/GitlabRepoFormBody';
import { useApiSpecForm } from '../hooks/useApiSpecForm';
import { useApiSpecSubmit } from '../hooks/useApiSpecSubmit';
import { useWebScrapeForm } from '../hooks/useWebScrapeForm';
import { useWebScrapeSubmit } from '../hooks/useWebScrapeSubmit';
import { useGitlabRepoForm } from '../hooks/useGitlabRepoForm';
import { useGitlabRepoSubmit } from '../hooks/useGitlabRepoSubmit';

interface AddDocsModalProps {
  open: boolean;
  onClose: () => void;
  existingLibrary?: {
    id: string;
    name: string;
  } | null;
  activeTab?: number;
}

const AddDocsModal: React.FC<AddDocsModalProps> = ({
  open,
  onClose,
  existingLibrary,
}) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Form data and submit hooks
  const apiSpecFormData = useApiSpecForm();
  const webScrapeFormData = useWebScrapeForm();
  const gitlabRepoFormData = useGitlabRepoForm();
  const apiSpecSubmit = useApiSpecSubmit(onClose, existingLibrary);
  const webScrapeSubmit = useWebScrapeSubmit(onClose, existingLibrary);
  const gitlabRepoSubmit = useGitlabRepoSubmit(onClose, existingLibrary);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTabIndex(newValue);
  };

  const handleSubmit = () => {
    if (activeTabIndex === 0) {
      webScrapeSubmit.submit(webScrapeFormData);
    } else if (activeTabIndex === 1) {
      apiSpecSubmit.submit(apiSpecFormData);
    } else if (activeTabIndex === 2) {
      gitlabRepoSubmit.submit(gitlabRepoFormData);
    }
  };

  const isProcessing = activeTabIndex === 0
    ? webScrapeSubmit.isProcessing
    : activeTabIndex === 1
      ? apiSpecSubmit.isProcessing
      : gitlabRepoSubmit.isProcessing;

  const modalTitle = existingLibrary
    ? `Add Resource to ${existingLibrary.name}`
    : 'Add New Documentation';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="add-docs-modal-title"
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle id="add-docs-modal-title">{modalTitle}</DialogTitle>
      <DialogContent
        dividers
        sx={{
          flex: 1,
          overflow: 'auto',
          paddingBottom: 0
        }}
      >
        <Box sx={{ borderBottom: 1, backgroundColor: 'inherit', borderColor: 'divider', top: -24 }}>
          <Tabs
            value={activeTabIndex}
            onChange={handleTabChange}
            aria-label="add docs tabs"
            sx={{
              backgroundColor:  'inherit'
            }}
          >
            <Tab label="Web Scrape" />
            <Tab label="API Specification" />
            <Tab label="GitLab Repo" />
          </Tabs>
        </Box>

        <TabPanel value={activeTabIndex} index={0}>
          <WebScrapeFormBody
            formData={webScrapeFormData}
            existingLibrary={existingLibrary}
          />
        </TabPanel>

        <TabPanel value={activeTabIndex} index={1}>
          <ApiSpecFormBody
            formData={apiSpecFormData}
            existingLibrary={existingLibrary}
          />
        </TabPanel>

        <TabPanel value={activeTabIndex} index={2}>
          <GitlabRepoFormBody
            formData={gitlabRepoFormData}
            hideLibraryFields={!!existingLibrary}
          />
        </TabPanel>
      </DialogContent>

      {!isProcessing && (
        <DialogActions sx={{ padding: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Submit'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AddDocsModal;
