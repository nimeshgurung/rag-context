import React from 'react';
import GitlabRepoForm from './GitlabRepoForm';
import { useGitlabRepoForm } from '../../hooks/useGitlabRepoForm';

interface GitlabRepoFormBodyProps {
  formData: ReturnType<typeof useGitlabRepoForm>;
  hideLibraryFields?: boolean;
}

const GitlabRepoFormBody: React.FC<GitlabRepoFormBodyProps> = ({ formData, hideLibraryFields }) => {
  return <GitlabRepoForm formData={formData} hideLibraryFields={hideLibraryFields} />;
};

export default GitlabRepoFormBody;
