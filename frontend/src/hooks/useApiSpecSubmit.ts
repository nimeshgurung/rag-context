import { useCallback } from 'react';
import { addDocumentationSource, addLibraryResource } from '../services/api';
import { useDialog } from '../context/DialogProvider';
import type { ApiSpecSource } from 'backend/src/lib/types';
import type { useApiSpecForm } from './useApiSpecForm';

interface ExistingLibrary {
  id: string;
  name: string;
}

interface UseApiSpecSubmitParams {
  existingLibrary?: ExistingLibrary | null;
  setProcessing: (processing: boolean) => void;
  addProgress: (message: string) => void;
  startListening: (
    jobId: string,
    onSuccess: () => void,
    onError: (error: unknown) => void
  ) => void;
  onModalClose: () => void;
}

export const useApiSpecSubmit = ({
  existingLibrary,
  setProcessing,
  addProgress,
  startListening,
  onModalClose,
}: UseApiSpecSubmitParams) => {
  const { showDialog } = useDialog();

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
                onModalClose();
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
              setTimeout(() => onModalClose(), 3000);
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
        setTimeout(() => onModalClose(), 3000);
      }
    },
    [existingLibrary, showDialog, setProcessing, addProgress, startListening, onModalClose],
  );

  return {
    handleApiSpecSubmit,
  };
};