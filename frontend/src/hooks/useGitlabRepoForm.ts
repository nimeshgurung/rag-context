import { useState } from 'react';

export interface GitlabRepoFormState {
  libraryName: string;
  description: string;
  repoUrl: string;
  ref: string;
  includeGlobs: string;
  excludeGlobs: string;
  additionalInstructions: string;
}

export interface GitlabRepoFormActions {
  setLibraryName: (name: string) => void;
  setDescription: (description: string) => void;
  setRepoUrl: (url: string) => void;
  setRef: (ref: string) => void;
  setIncludeGlobs: (globs: string) => void;
  setExcludeGlobs: (globs: string) => void;
  setAdditionalInstructions: (instructions: string) => void;
  reset: () => void;
  validate: () => boolean;
}

const initialState: GitlabRepoFormState = {
  libraryName: '',
  description: '',
  repoUrl: '',
  ref: '',
  includeGlobs: '',
  excludeGlobs: '',
  additionalInstructions: '',
};

export const useGitlabRepoForm = () => {
  const [state, setState] = useState<GitlabRepoFormState>(initialState);

  const setLibraryName = (libraryName: string) => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, libraryName }));
  };

  const setDescription = (description: string) => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, description }));
  };

  const setRepoUrl = (repoUrl: string) => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, repoUrl }));
  };

  const setRef = (ref: string) => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, ref }));
  };

  const setIncludeGlobs = (includeGlobs: string) => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, includeGlobs }));
  };

  const setExcludeGlobs = (excludeGlobs: string) => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, excludeGlobs }));
  };

  const setAdditionalInstructions = (additionalInstructions: string) => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, additionalInstructions }));
  };

  const reset = () => {
    setState((prev: GitlabRepoFormState) => ({ ...prev, ...initialState }));
  };

  const validate = (): boolean => {
    // For existing library, we don't need libraryName and description
    // But we always need a valid repo URL
    if (!state.repoUrl) return false;

    // Basic URL validation for GitLab
    try {
      const url = new URL(state.repoUrl);
      // Should be https and contain gitlab
      return url.protocol === 'https:' &&
             (url.hostname.includes('gitlab') || url.hostname.includes('git'));
    } catch {
      return false;
    }
  };

  const validateForNewLibrary = (): boolean => {
    return !!(state.libraryName && state.description && validate());
  };

  return {
    ...state,
    setLibraryName,
    setDescription,
    setRepoUrl,
    setRef,
    setIncludeGlobs,
    setExcludeGlobs,
    setAdditionalInstructions,
    reset,
    validate,
    validateForNewLibrary,
  };
};
