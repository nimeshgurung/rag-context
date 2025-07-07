import { useState, useEffect, useCallback } from 'react';
import * as React from 'react';
import { addDocumentationSource } from '../services/api';
import { useDialog } from '../context/DialogProvider';
import { useJobProgress } from './useJobProgress';
import { useApiSpecForm } from './useApiSpecForm';
import { useWebScrapeForm } from './useWebScrapeForm';
import type { ApiSpecSource, WebScrapeSource } from '../../../src/lib/types';
import usePrevious from 'use-previous';

export const useAddDocsModal = (open: boolean, onClose: () => void) => {
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
      if (!formData.validate()) {
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
          name: formData.libraryName,
          description: formData.description,
          sourceType: formData.uploadType,
          content,
        };

        setProcessing(true);
        addProgress('Submitting API specification...');

        const res = await addDocumentationSource(source);
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
    [setProcessing, addProgress, startListening, showDialog, onClose],
  );

  const handleWebScrapeSubmit = useCallback(
    async (formData: ReturnType<typeof useWebScrapeForm>) => {
      if (!formData.validate()) {
        showDialog(
          'Missing Information',
          'Library Name, Description, and Start URL are required.',
        );
        return;
      }

      const source: WebScrapeSource = {
        type: 'web-scrape',
        name: formData.libraryName,
        description: formData.description,
        startUrl: formData.startUrl,
        config: {
          scrapeType: formData.scrapeType,
          contentSelector: formData.contentSelector || undefined,
          codeSelector: formData.codeSelector || undefined,
          preExecutionSteps: formData.preExecutionSteps || undefined,
          maxDepth:
            formData.maxDepth === '' ? undefined : Number(formData.maxDepth),
          customEnrichmentPrompt: formData.customEnrichmentPrompt || undefined,
        },
      };

      try {
        setProcessing(true);
        addProgress('Submitting web scrape job...');

        const res = await addDocumentationSource(source);
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
    [setProcessing, addProgress, startListening, showDialog, onClose],
  );

  return {
    activeTab,
    handleTabChange,
    handleApiSpecSubmit,
    handleWebScrapeSubmit,
    getApiSpecContent,
    isProcessing,
    progress,
  };
};
