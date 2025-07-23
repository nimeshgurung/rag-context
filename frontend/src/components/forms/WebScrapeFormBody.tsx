import React from 'react';
import WebScrapeForm from './WebScrapeForm';
import { useWebScrapeForm } from '../../hooks/useWebScrapeForm';

interface WebScrapeFormBodyProps {
  formData: ReturnType<typeof useWebScrapeForm>;
  existingLibrary?: {
    id: string;
    name: string;
  } | null;
}

const WebScrapeFormBody: React.FC<WebScrapeFormBodyProps> = ({
  formData,
  existingLibrary,
}) => {
  return (
    <WebScrapeForm
      formData={formData}
      hideLibraryFields={!!existingLibrary}
    />
  );
};

export default WebScrapeFormBody;