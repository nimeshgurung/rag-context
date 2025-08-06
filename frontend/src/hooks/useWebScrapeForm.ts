import { useState } from 'react';

export interface WebScrapeFormState {
  libraryName: string;
  description: string;
  startUrl: string;
  preExecutionSteps: string;
  customEnrichmentPrompt: string;
}

export interface WebScrapeFormActions {
  setLibraryName: (name: string) => void;
  setDescription: (description: string) => void;
  setStartUrl: (url: string) => void;
  setPreExecutionSteps: (steps: string) => void;
  setCustomEnrichmentPrompt: (prompt: string) => void;
  reset: () => void;
  validate: () => boolean;
}

const initialState: WebScrapeFormState = {
  libraryName: '',
  description: '',
  startUrl: '',
  preExecutionSteps: '',
  customEnrichmentPrompt: '',
};

export const useWebScrapeForm = () => {
  const [state, setState] = useState<WebScrapeFormState>(initialState);

  const setLibraryName = (libraryName: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, libraryName }));
  };

  const setDescription = (description: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, description }));
  };

  const setStartUrl = (startUrl: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, startUrl }));
  };

  const setPreExecutionSteps = (preExecutionSteps: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, preExecutionSteps }));
  };

  const setCustomEnrichmentPrompt = (customEnrichmentPrompt: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, customEnrichmentPrompt }));
  };

  const reset = () => {
    setState((prev: WebScrapeFormState) => ({ ...prev, ...initialState }));
  };

  const validate = (): boolean => {
    return !!(state.libraryName && state.description && state.startUrl);
  };

  return {
    ...state,
    setLibraryName,
    setDescription,
    setStartUrl,
    setPreExecutionSteps,
    setCustomEnrichmentPrompt,
    reset,
    validate,
  };
};
