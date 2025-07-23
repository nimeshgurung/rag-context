import { useDialog } from '../context/DialogProvider';
import { useAddLibraryResource } from './mutations/useAddLibraryResource';
import { useAddDocumentationSource } from './mutations/useAddDocumentationSource';
import type { WebScrapeSource } from 'backend/src/lib/types';
import type { useWebScrapeForm } from './useWebScrapeForm';

export const useWebScrapeSubmit = (
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

  const submit = (formData: ReturnType<typeof useWebScrapeForm>) => {
    const {
      libraryName,
      description,
      startUrl,
      customEnrichmentPrompt,
      scrapeType,
      contentSelector,
      codeSelector,
      maxDepth,
    } = formData;

    const source: WebScrapeSource = {
      type: 'web-scrape',
      name: libraryName,
      description,
      startUrl,
      config: {
        scrapeType,
        contentSelector,
        codeSelector,
        maxDepth: maxDepth || undefined,
        customEnrichmentPrompt,
      },
    };

    const context = { activeTab };

    if (existingLibrary) {
      addResource(
        { libraryId: existingLibrary.id, source, context },
        { onSuccess: () => commonSuccessHandler('Resource addition') }
      );
    } else {
      addDocumentationSource(
        { source },
        { onSuccess: () => commonSuccessHandler('Source added') }
      );
    }
  };

  return { submit, isProcessing };
};