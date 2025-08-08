import { useDialog } from '../context/DialogProvider';
import { useAddLibraryResource } from './mutations/useAddLibraryResource';
import { useAddDocumentationSource } from './mutations/useAddDocumentationSource';
import type { GitlabRepoSource } from 'backend/src/lib/types';
import type { useGitlabRepoForm } from './useGitlabRepoForm';

export const useGitlabRepoSubmit = (
  onClose: () => void,
  existingLibrary?: { id: string; name: string } | null,
  activeTab?: number
) => {
  const { showSnackbar } = useDialog();
  const { mutate: addResource, isPending: isAddingResource } =
    useAddLibraryResource();
  const { mutate: addDocumentationSource, isPending: isAddingDocs } =
    useAddDocumentationSource();

  const isProcessing = isAddingResource || isAddingDocs;

  const commonSuccessHandler = (action: string) => {
    showSnackbar(`${action} started successfully!`, 'success');
    onClose();
  };

  const submit = (formData: ReturnType<typeof useGitlabRepoForm>) => {
    const {
      libraryName,
      description,
      repoUrl,
      ref,
      includeGlobs,
      excludeGlobs,
      additionalInstructions,
    } = formData;

    // Parse globs from comma-separated strings to arrays
    const parseGlobs = (globString: string): string[] => {
      if (!globString.trim()) return [];
      return globString.split(',').map(g => g.trim()).filter(g => g);
    };

    const source: GitlabRepoSource = {
      type: 'gitlab-repo',
      name: libraryName,
      description,
      repoUrl,
      ref: ref || undefined,
      config: {
        includeGlobs: parseGlobs(includeGlobs),
        excludeGlobs: parseGlobs(excludeGlobs),
        additionalInstructions: additionalInstructions || undefined,
      },
    };

    const context = { activeTab };

    if (existingLibrary) {
      addResource(
        { libraryId: existingLibrary.id, source, context },
        { onSuccess: () => commonSuccessHandler('GitLab repository ingestion') }
      );
    } else {
      addDocumentationSource(
        { source },
        { onSuccess: () => commonSuccessHandler('GitLab repository added') }
      );
    }
  };

  return { submit, isProcessing };
};
