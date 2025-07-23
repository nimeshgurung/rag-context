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

import ApiSpecForm from './forms/ApiSpecForm';
import WebScrapeForm from './forms/WebScrapeForm';
import TabPanel from './TabPanel';
import { useApiSpecForm } from '../hooks/useApiSpecForm';
import { useWebScrapeForm } from '../hooks/useWebScrapeForm';
import { useAddLibraryResource } from '../hooks/mutations/useAddLibraryResource';
import { useStartCrawl } from '../hooks/mutations/useStartCrawl';
import { useDialog } from '../context/DialogProvider';
import type { ApiSpecSource, WebScrapeSource } from 'backend/src/lib/types';

interface AddDocsModalProps {
  open: boolean;
  onClose: () => void;
  existingLibrary?: {
    id: string;
    name: string;
  } | null;
}

const AddDocsModal: React.FC<AddDocsModalProps> = ({
  open,
  onClose,
  existingLibrary,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const apiSpecFormData = useApiSpecForm();
  const webScrapeFormData = useWebScrapeForm();
  const { showSnackbar } = useDialog();

  const { mutate: addResource, isPending: isAddingResource } =
    useAddLibraryResource();
  const { mutate: startCrawl, isPending: isStartingCrawl } = useStartCrawl();

  const isProcessing = isAddingResource || isStartingCrawl;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSubmit = () => {
    const commonSuccessHandler = (action: string) => {
      showSnackbar(`${action} started successfully!`, 'success');
      onClose();
    };

    if (activeTab === 0) {
      // API Spec
      const { libraryName, description, textContent, file, uploadType } = apiSpecFormData;
      const source: ApiSpecSource = {
        type: 'api-spec',
        name: libraryName,
        description,
        sourceType: uploadType,
        content: file ? file.name : textContent,
      };
      if (existingLibrary) {
        addResource(
          { libraryId: existingLibrary.id, source },
          { onSuccess: () => commonSuccessHandler('Resource addition') }
        );
      } else {
        startCrawl(
          {
            libraryName,
            libraryDescription: description,
            startUrl: '', // Not applicable
            scrapeType: 'documentation', // Assuming default, as it's not specified for API
          },
          { onSuccess: () => commonSuccessHandler('Crawl') }
        );
      }
    } else {
      // Web Scrape
      const {
        libraryName,
        description,
        startUrl,
        customEnrichmentPrompt,
        scrapeType,
        contentSelector,
        codeSelector,
        maxDepth,
      } = webScrapeFormData;
      const source: WebScrapeSource = {
        type: 'web-scrape',
        name: libraryName,
        description,
        startUrl,
        config: {
          scrapeType,
          contentSelector,
          codeSelector,
          maxDepth: maxDepth || undefined,
          customEnrichmentPrompt,
        },
      };
      if (existingLibrary) {
        addResource(
          { libraryId: existingLibrary.id, source },
          { onSuccess: () => commonSuccessHandler('Resource addition') }
        );
      } else {
        startCrawl(
          {
            libraryName,
            libraryDescription: description,
            startUrl,
            scrapeType,
            customEnrichmentPrompt,
          },
          { onSuccess: () => commonSuccessHandler('Crawl') }
        );
      }
    }
  };

  const modalTitle = existingLibrary
    ? `Add Resource to ${existingLibrary.name}`
    : 'Add New Documentation';

  return (
    <Dialog
      open={open}
      onClose={isProcessing ? undefined : onClose}
      aria-labelledby="add-docs-modal-title"
      fullWidth
      maxWidth="md"
    >
      <DialogTitle id="add-docs-modal-title">{modalTitle}</DialogTitle>
      <DialogContent dividers>
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
            <ApiSpecForm
              formData={apiSpecFormData}
              hideLibraryFields={!!existingLibrary}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <WebScrapeForm
              formData={webScrapeFormData}
              hideLibraryFields={!!existingLibrary}
            />
          </TabPanel>
        </>
      </DialogContent>
      {!isProcessing && (
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Submit'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AddDocsModal;
