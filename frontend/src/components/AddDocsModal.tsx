import React from 'react';
import {
  Modal,
  Box,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';

import ApiSpecForm from './forms/ApiSpecForm';
import WebScrapeForm from './forms/WebScrapeForm';
import JobProgressDisplay from './JobProgressDisplay';
import TabPanel from './TabPanel';
import { useAddDocsModal } from '../hooks/useAddDocsModal';

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

const AddDocsModal: React.FC<AddDocsModalProps> = ({ open, onClose }) => {
  const { activeTab, handleTabChange, handleApiSpecSubmit, handleWebScrapeSubmit, isProcessing, progress } = useAddDocsModal(open, onClose);

  const handleCloseModal = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleCloseModal}
      aria-labelledby="add-docs-modal-title"
      aria-describedby="add-docs-modal-description"
    >
      <Box sx={style}>
        { isProcessing ? (
          <JobProgressDisplay progress={progress} />
        ) : (
          <>
            <Typography id="add-docs-modal-title" variant="h6" component="h2">
              Add New Documentation
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
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
              <ApiSpecForm
                onSubmit={handleApiSpecSubmit}
                onCancel={onClose}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <WebScrapeForm
                onSubmit={handleWebScrapeSubmit}
                onCancel={onClose}
              />
            </TabPanel>
          </>
        )}
      </Box>
    </Modal>
  );
};

export default AddDocsModal;
