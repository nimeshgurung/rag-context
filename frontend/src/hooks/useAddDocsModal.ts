import { useState, useEffect, useCallback } from 'react';
import * as React from 'react';
import { addDocumentationSource } from '../services/api';
import { useDialog } from '../context/DialogProvider';
import { useJobProgress } from './useJobProgress';
import { useApiSpecForm } from './useApiSpecForm';
import { useWebScrapeForm } from './useWebScrapeForm';
import type { ApiSpecSource, WebScrapeSource } from '../../../src/lib/types';

export const useAddDocsModal = (open: boolean, onClose: () => void) => {
  const [activeTab, setActiveTab] = useState(0);
  const { showDialog } = useDialog();
  const jobProgress = useJobProgress();
  const apiSpecForm = useApiSpecForm();
  const webScrapeForm = useWebScrapeForm();

  // Reset all forms when modal closes
  useEffect(() => {
    if (!open) {
      jobProgress.reset();
      apiSpecForm.reset();
      webScrapeForm.reset();
      setActiveTab(0);
    }
  }, [open, jobProgress, apiSpecForm, webScrapeForm]);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  const handleApiSpecSubmit = useCallback(async (formData: ReturnType<typeof useApiSpecForm>) => {
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

      jobProgress.setProcessing(true);
      jobProgress.addProgress('Submitting API specification...');

      const res = await addDocumentationSource(source);
      if (res.jobId) {
        jobProgress.addProgress('Processing started. Listening for updates...');
        const eventSource = jobProgress.startListening(res.jobId);
        
        // Auto-close modal after job completion
        setTimeout(() => {
          eventSource.close();
          onClose();
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to add API Spec source', error);
      jobProgress.addProgress('Error submitting job.');
      setTimeout(() => onClose(), 3000);
    }
  }, [jobProgress, showDialog, onClose]);

  const handleWebScrapeSubmit = useCallback(async (formData: ReturnType<typeof useWebScrapeForm>) => {
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
        contentSelector: formData.contentSelector || undefined,
        codeSelector: formData.codeSelector || undefined,
        preExecutionSteps: formData.preExecutionSteps || undefined,
        maxDepth: formData.maxDepth === '' ? undefined : Number(formData.maxDepth),
      },
    };

    try {
      jobProgress.setProcessing(true);
      jobProgress.addProgress('Submitting web scrape job...');

      const res = await addDocumentationSource(source);
      if (res.jobId) {
        jobProgress.addProgress('Processing started. Listening for updates...');
        const eventSource = jobProgress.startListening(res.jobId);
        
        // Auto-close modal after job completion
        setTimeout(() => {
          eventSource.close();
          onClose();
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to add Web Scrape source', error);
      jobProgress.addProgress('Error submitting job.');
      if (error instanceof Error) {
        showDialog('Error', `Error: ${error.message}`);
      } else {
        showDialog('Error', 'An unknown error occurred.');
      }
    }
  }, [jobProgress, showDialog, onClose]);

  return {
    activeTab,
    handleTabChange,
    handleApiSpecSubmit,
    handleWebScrapeSubmit,
    jobProgress,
    apiSpecForm,
    webScrapeForm,
  };
};