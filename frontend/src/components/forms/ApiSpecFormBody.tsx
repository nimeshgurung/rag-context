import React from 'react';
import ApiSpecForm from './ApiSpecForm';
import { useApiSpecForm } from '../../hooks/useApiSpecForm';

interface ApiSpecFormBodyProps {
  formData: ReturnType<typeof useApiSpecForm>;
  existingLibrary?: {
    id: string;
    name: string;
  } | null;
}

const ApiSpecFormBody: React.FC<ApiSpecFormBodyProps> = ({
  formData,
  existingLibrary,
}) => {
  return (
    <ApiSpecForm
      formData={formData}
      hideLibraryFields={!!existingLibrary}
    />
  );
};

export default ApiSpecFormBody;