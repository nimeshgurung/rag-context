import { useState,  useCallback } from 'react';
import * as React from 'react';
import { useJobProgress } from './useJobProgress';
import { useApiSpecForm } from './useApiSpecForm';
import { useWebScrapeForm } from './useWebScrapeForm';
import { useApiSpecSubmit } from './useApiSpecSubmit';
import { useWebScrapeSubmit } from './useWebScrapeSubmit';

interface ExistingLibrary {
  id: string;
  name: string;
}

export const useAddDocsModal = (
  existingLibrary?: ExistingLibrary | null
) => {
  const [activeTab, setActiveTab] = useState(0);
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

  const onModalClose = useCallback(() => {
    resetJobProgress();
    resetApiSpecForm();
    resetWebScrapeForm();
    setActiveTab(0);
  }, [resetJobProgress, resetApiSpecForm, resetWebScrapeForm]);

  const handleTabChange = useCallback(
    (_event: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
    },
    [],
  );

  const { handleApiSpecSubmit } = useApiSpecSubmit({
    existingLibrary,
    setProcessing,
    addProgress,
    startListening,
    onModalClose,
  });

  const { handleWebScrapeSubmit } = useWebScrapeSubmit({
    existingLibrary,
    setProcessing,
    addProgress,
    startListening,
    onModalClose,
  });

  return {
    activeTab,
    onModalClose,
    handleTabChange,
    handleApiSpecSubmit,
    handleWebScrapeSubmit,
    getApiSpecContent,
    isProcessing,
    progress,
    existingLibrary,
  };
};
