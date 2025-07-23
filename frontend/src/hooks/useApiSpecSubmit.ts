import { useDialog } from '../context/DialogProvider';
import { useAddLibraryResource } from './mutations/useAddLibraryResource';
import { useAddDocumentationSource } from './mutations/useAddDocumentationSource';
import type { ApiSpecSource } from 'backend/src/lib/types';
import type { useApiSpecForm } from './useApiSpecForm';

export const useApiSpecSubmit = (
  onClose: () => void,
  existingLibrary?: { id: string; name: string } | null,
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

  const submit = async (formData: ReturnType<typeof useApiSpecForm>) => {
    const { libraryName, description, textContent, file, uploadType } =
      formData;

    const content =
      uploadType === 'file' && file
        ? await file.text()
        : textContent;

    if (!content) {
      showSnackbar('No content provided for API spec.', 'error');
      return;
    }

    const source: ApiSpecSource = {
      type: 'api-spec',
      name: libraryName,
      description,
      sourceType: uploadType,
      content,
    };

    if (existingLibrary) {
      addResource(
        { libraryId: existingLibrary.id, source },
        { onSuccess: () => commonSuccessHandler('Resource addition') }
      );
    } else {
      addDocumentationSource(
        { source },
        { onSuccess: () => commonSuccessHandler('Spec added') }
      );
    }
  };

  return { submit, isProcessing };
};