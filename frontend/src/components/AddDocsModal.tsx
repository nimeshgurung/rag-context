import React from 'react';
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

import ApiSpecForm from './forms/ApiSpecForm';
import WebScrapeForm from './forms/WebScrapeForm';
import JobProgressDisplay from './JobProgressDisplay';
import TabPanel from './TabPanel';
import { useAddDocsModal } from '../hooks/useAddDocsModal';
import { useApiSpecForm } from '../hooks/useApiSpecForm';
import { useWebScrapeForm } from '../hooks/useWebScrapeForm';

interface AddDocsModalProps {
  open: boolean;
  onClose: () => void;
}

const AddDocsModal: React.FC<AddDocsModalProps> = ({ open, onClose }) => {
  const {
    activeTab,
    handleTabChange,
    handleApiSpecSubmit,
    handleWebScrapeSubmit,
    isProcessing,
    progress,
  } = useAddDocsModal(open, onClose);
  const apiSpecFormData = useApiSpecForm();
  const webScrapeFormData = useWebScrapeForm();

  const handleCloseModal = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  const handleSubmit = () => {
    if (activeTab === 0) {
      handleApiSpecSubmit(apiSpecFormData);
    } else {
      handleWebScrapeSubmit(webScrapeFormData);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCloseModal}
      aria-labelledby="add-docs-modal-title"
      fullWidth
      maxWidth="md"
    >
      <DialogTitle id="add-docs-modal-title">
        Add New Documentation
      </DialogTitle>
      <DialogContent dividers>
        {isProcessing ? (
          <JobProgressDisplay progress={progress} />
        ) : (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                aria-label="add docs tabs"
              >
                <Tab label="API Specification" />
                <Tab label="Web Scrape" />
              </Tabs>
            </Box>

            <TabPanel value={activeTab} index={0}>
              <ApiSpecForm formData={apiSpecFormData} />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <WebScrapeForm formData={webScrapeFormData} />
            </TabPanel>
          </>
        )}
      </DialogContent>
      {!isProcessing && (
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Submit
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AddDocsModal;
