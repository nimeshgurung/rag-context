import { useState, useEffect, useCallback } from 'react';
import * as React from 'react';
import { addDocumentationSource, addLibraryResource } from '../services/api';
import { useDialog } from '../context/DialogProvider';
import { useJobProgress } from './useJobProgress';
import { useApiSpecForm } from './useApiSpecForm';
import { useWebScrapeForm } from './useWebScrapeForm';
import type { ApiSpecSource, WebScrapeSource } from '../../../src/lib/types';
import usePrevious from 'use-previous';

interface ExistingLibrary {
  id: string;
  name: string;
}

export const useAddDocsModal = (
  open: boolean,
  onClose: () => void,
  existingLibrary?: ExistingLibrary | null
) => {
  const [activeTab, setActiveTab] = useState(0);
  const { showDialog } = useDialog();
  const {
    reset: resetJobProgress,
    setProcessing,
    addProgress,
    startListening,
    isProcessing,
    progress,
  } = useJobProgress();
  const { reset: resetApiSpecForm, getContent: getApiSpecContent } =
    useApiSpecForm();
  const { reset: resetWebScrapeForm } = useWebScrapeForm();
  const previousOpen = usePrevious<boolean>(open || false);

  // Reset all forms when modal closes
  useEffect(() => {
    if (!open && previousOpen) {
      resetJobProgress();
      resetApiSpecForm();
      resetWebScrapeForm();
      setActiveTab(0);
    }
  }, [
    open,
    previousOpen,
    resetJobProgress,
    resetApiSpecForm,
    resetWebScrapeForm,
  ]);

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
    },
    [],
  );

  const handleApiSpecSubmit = useCallback(
    async (formData: ReturnType<typeof useApiSpecForm>) => {
      // When adding to existing library, we don't need library name/description
      if (!existingLibrary && !formData.validate()) {
        showDialog(
          'Missing Information',
          'Library Name and Description are required.',
        );
        return;
      }

      try {
        const content = await formData.getContent();
        if (!content) {
          showDialog(
            'Missing Information',
            'Please select a file or paste content.',
          );
          return;
        }

        const source: ApiSpecSource = {
          type: 'api-spec',
          name: existingLibrary ? formData.libraryName || `${existingLibrary.name} API Spec` : formData.libraryName,
          description: existingLibrary
            ? formData.description || `API specification for ${existingLibrary.name}`
            : formData.description,
          sourceType: formData.uploadType,
          content,
        };

        setProcessing(true);
        addProgress(existingLibrary
          ? `Adding API specification to ${existingLibrary.name}...`
          : 'Submitting API specification...'
        );

        const res = existingLibrary
          ? await addLibraryResource(existingLibrary.id, source)
          : await addDocumentationSource(source);

        if (res.jobId) {
          addProgress('Processing started. Listening for updates...');
          startListening(
            res.jobId,
            () => {
              addProgress('Job completed successfully!');
              setTimeout(() => {
                onClose();
              }, 1500);
            },
            (error) => {
              addProgress('An error occurred during processing.');
              showDialog(
                'Error',
                `An error occurred during processing: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              );
              setTimeout(() => onClose(), 3000);
            },
          );
        }
      } catch (error) {
        console.error('Failed to add API Spec source', error);
        addProgress('Error submitting job.');
        showDialog(
          'Error',
          `Failed to submit job: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        setTimeout(() => onClose(), 3000);
      }
    },
    [setProcessing, addProgress, startListening, showDialog, onClose, existingLibrary],
  );

  const handleWebScrapeSubmit = useCallback(
    async (formData: ReturnType<typeof useWebScrapeForm>) => {
      // When adding to existing library, we don't need library name/description
      if (!existingLibrary && !formData.validate()) {
        showDialog(
          'Missing Information',
          'Library Name, Description, and Start URL are required.',
        );
        return;
      }

      // For existing library, we still need the URL
      if (!formData.startUrl) {
        showDialog(
          'Missing Information',
          'Start URL is required.',
        );
        return;
      }

      const source: WebScrapeSource = {
        type: 'web-scrape',
        name: existingLibrary ? existingLibrary.name : formData.libraryName,
        description: existingLibrary
          ? `Additional resource for ${existingLibrary.name}`
          : formData.description,
        startUrl: formData.startUrl,
        config: {
          scrapeType: formData.scrapeType,
          contentSelector: formData.contentSelector || undefined,
          codeSelector: formData.codeSelector || undefined,
          preExecutionSteps: formData.preExecutionSteps || undefined,
          maxDepth:
            formData.maxDepth === '' ? undefined : Number(formData.maxDepth),
        },
      };

      try {
        setProcessing(true);
        addProgress(existingLibrary
          ? `Adding web resource to ${existingLibrary.name}...`
          : 'Submitting web scrape job...'
        );

        const res = existingLibrary
          ? await addLibraryResource(existingLibrary.id, source)
          : await addDocumentationSource(source);

        if (res.jobId) {
          addProgress('Processing started. Listening for updates...');
          startListening(
            res.jobId,
            () => {
              addProgress('Job completed successfully!');
              setTimeout(() => {
                onClose();
              }, 1500);
            },
            (error) => {
              addProgress('An error occurred during processing.');
              if (error instanceof Error) {
                showDialog('Error', `Error: ${error.message}`);
              } else {
                showDialog('Error', 'An unknown error occurred.');
              }
              setTimeout(() => onClose(), 3000);
            },
          );
        }
      } catch (error) {
        console.error('Failed to add Web Scrape source', error);
        addProgress('Error submitting job.');
        showDialog(
          'Error',
          `Failed to submit job: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        setTimeout(() => onClose(), 3000);
      }
    },
    [setProcessing, addProgress, startListening, showDialog, onClose, existingLibrary],
  );

  return {
    activeTab,
    handleTabChange,
    handleApiSpecSubmit,
    handleWebScrapeSubmit,
    getApiSpecContent,
    isProcessing,
    progress,
    existingLibrary,
  };
};
