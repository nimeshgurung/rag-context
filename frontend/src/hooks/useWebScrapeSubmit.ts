import { useCallback } from 'react';
import { addDocumentationSource, addLibraryResource } from '../services/api';
import { useDialog } from '../context/DialogProvider';
import type { WebScrapeSource } from 'backend/src/lib/types';
import type { useWebScrapeForm } from './useWebScrapeForm';

interface ExistingLibrary {
  id: string;
  name: string;
}

interface UseWebScrapeSubmitParams {
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

export const useWebScrapeSubmit = ({
  existingLibrary,
  setProcessing,
  addProgress,
  startListening,
  onModalClose,
}: UseWebScrapeSubmitParams) => {
  const { showDialog } = useDialog();

  const handleWebScrapeSubmit = useCallback(
    async (formData: ReturnType<typeof useWebScrapeForm>) => {
      // When adding to existing library, we don't need library name/description
      if (!existingLibrary && !formData.validate()) {
        showDialog(
          'Missing Information',
          'Library Name, Description, and Start URL are required.',
        );
        return;
      }

      // For existing library, we still need the URL
      if (!formData.startUrl) {
        showDialog(
          'Missing Information',
          'Start URL is required.',
        );
        return;
      }

      const source: WebScrapeSource = {
        type: 'web-scrape',
        name: existingLibrary ? existingLibrary.name : formData.libraryName,
        description: existingLibrary
          ? `Additional resource for ${existingLibrary.name}`
          : formData.description,
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
        addProgress(existingLibrary
          ? `Adding web resource to ${existingLibrary.name}...`
          : 'Submitting web scrape job...'
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
              if (error instanceof Error) {
                showDialog('Error', `Error: ${error.message}`);
              } else {
                showDialog('Error', 'An unknown error occurred.');
              }
              setTimeout(() => onModalClose(), 3000);
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
        setTimeout(() => onModalClose(), 3000);
      }
    },
    [existingLibrary, showDialog, setProcessing, addProgress, startListening, onModalClose],
  );

  return {
    handleWebScrapeSubmit,
  };
};