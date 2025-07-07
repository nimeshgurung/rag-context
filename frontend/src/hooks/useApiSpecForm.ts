import { useState } from 'react';

export interface ApiSpecFormState {
  libraryName: string;
  description: string;
  uploadType: 'file' | 'text';
  file: File | null;
  textContent: string;
}

export interface ApiSpecFormActions {
  setLibraryName: (name: string) => void;
  setDescription: (description: string) => void;
  setUploadType: (type: 'file' | 'text') => void;
  setFile: (file: File | null) => void;
  setTextContent: (content: string) => void;
  reset: () => void;
  validate: () => boolean;
  getContent: () => Promise<string | null>;
}

const initialState: ApiSpecFormState = {
  libraryName: '',
  description: '',
  uploadType: 'file',
  file: null,
  textContent: '',
};

export const useApiSpecForm = () => {
  const [state, setState] = useState<ApiSpecFormState>(initialState);

  const setLibraryName = (libraryName: string) => {
    setState((prev: ApiSpecFormState) => ({ ...prev, libraryName }));
  };

  const setDescription = (description: string) => {
    setState((prev: ApiSpecFormState) => ({ ...prev, description }));
  };

  const setUploadType = (uploadType: 'file' | 'text') => {
    setState((prev: ApiSpecFormState) => ({ ...prev, uploadType }));
  };

  const setFile = (file: File | null) => {
    setState((prev: ApiSpecFormState) => ({ ...prev, file }));
  };

  const setTextContent = (textContent: string) => {
    setState((prev: ApiSpecFormState) => ({ ...prev, textContent }));
  };

  const reset = () => {
    setState(initialState);
  };

  const validate = (): boolean => {
    return !!(state.libraryName && state.description);
  };

  const getContent = async (): Promise<string | null> => {
    if (state.uploadType === 'file' && state.file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        reader.readAsText(state.file as File);
      });
    } else if (state.uploadType === 'text' && state.textContent) {
      return state.textContent;
    }
    return null;
  };

  return {
    ...state,
    setLibraryName,
    setDescription,
    setUploadType,
    setFile,
    setTextContent,
    reset,
    validate,
    getContent,
  };
};
