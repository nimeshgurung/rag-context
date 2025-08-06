import { useState } from 'react';

export interface WebScrapeFormState {
  libraryName: string;
  description: string;
  startUrl: string;
  preExecutionSteps: string;
  additionalInstructions: string;
}

export interface WebScrapeFormActions {
  setLibraryName: (name: string) => void;
  setDescription: (description: string) => void;
  setStartUrl: (url: string) => void;
  setPreExecutionSteps: (steps: string) => void;
  setAdditionalInstructions: (instructions: string) => void;
  reset: () => void;
  validate: () => boolean;
}

const initialState: WebScrapeFormState = {
  libraryName: '',
  description: '',
  startUrl: '',
  preExecutionSteps: '',
  additionalInstructions: '',
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

  const setAdditionalInstructions = (additionalInstructions: string) => {
    setState((prev: WebScrapeFormState) => ({ ...prev, additionalInstructions }));
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
    setAdditionalInstructions,
    reset,
    validate,
  };
};
