import { useState } from 'react';

export interface WebScrapeFormState {
  libraryName: string;
  description: string;
  startUrl: string;
  contentSelector: string;
  codeSelector: string;
  preExecutionSteps: string;
  maxDepth: number | '';
  customEnrichmentPrompt: string;
}

export interface WebScrapeFormActions {
  setLibraryName: (name: string) => void;
  setDescription: (description: string) => void;
  setStartUrl: (url: string) => void;
  setContentSelector: (selector: string) => void;
  setCodeSelector: (selector: string) => void;
  setPreExecutionSteps: (steps: string) => void;
  setMaxDepth: (depth: number | '') => void;

  setCustomEnrichmentPrompt: (prompt: string) => void;
  reset: () => void;
  validate: () => boolean;
}

const initialState: WebScrapeFormState = {
  libraryName: '',
  description: '',
  startUrl: '',
  contentSelector: '',
  codeSelector: '',
  preExecutionSteps: '',
  maxDepth: '',

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

  const setContentSelector = (contentSelector: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, contentSelector }));
  };

  const setCodeSelector = (codeSelector: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, codeSelector }));
  };

  const setPreExecutionSteps = (preExecutionSteps: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, preExecutionSteps }));
  };

  const setMaxDepth = (maxDepth: number | '') => {
    setState((prev: WebScrapeFormState) => ({ ...prev, maxDepth }));
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
    setContentSelector,
    setCodeSelector,
    setPreExecutionSteps,
    setMaxDepth,

    setCustomEnrichmentPrompt,
    reset,
    validate,
  };
};
