import React from 'react';
import {
  Box,
  TextField,
  Typography,
} from '@mui/material';
import { useGitlabRepoForm } from '../../hooks/useGitlabRepoForm';

interface GitlabRepoFormProps {
  formData: ReturnType<typeof useGitlabRepoForm>;
  hideLibraryFields?: boolean;
}

const GitlabRepoForm: React.FC<GitlabRepoFormProps> = ({ formData, hideLibraryFields = false }) => {
  const {
    libraryName,
    description,
    repoUrl,
    ref,
    includeGlobs,
    excludeGlobs,
    additionalInstructions,
    setLibraryName,
    setDescription,
    setRepoUrl,
    setRef,
    setIncludeGlobs,
    setExcludeGlobs,
    setAdditionalInstructions,
  } = formData;

  return (
    <Box
      component="form"
      noValidate
      autoComplete="off"
      sx={{ '& .MuiTextField-root': { m: 1, width: '95%' } }}
    >
      {!hideLibraryFields && (
        <>
          <TextField
            required
            label="Library Name"
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            size="small"
          />
          <TextField
            required
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            size="small"
          />
        </>
      )}
      <TextField
        required
        label="Repository URL"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        size="small"
        helperText={hideLibraryFields
          ? "GitLab repository URL to ingest documentation from"
          : "GitLab repository URL (e.g., https://gitlab.com/group/project)"}
      />
      <TextField
        label="Branch/Tag/Ref"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        size="small"
        helperText="Optional: Specific branch, tag, or commit SHA (defaults to default branch)"
      />

      <Typography variant="subtitle2" sx={{ m: 1, mt: 2 }}>
        Advanced (Optional)
      </Typography>

      <TextField
        label="Include Globs"
        value={includeGlobs}
        onChange={(e) => setIncludeGlobs(e.target.value)}
        helperText="File patterns to include (comma-separated, e.g., docs/**/*.md, README.md)"
        multiline
        rows={2}
        size="small"
      />

      <TextField
        label="Exclude Globs"
        value={excludeGlobs}
        onChange={(e) => setExcludeGlobs(e.target.value)}
        helperText="File patterns to exclude (comma-separated, e.g., test/**/*.md, **/draft-*.md)"
        multiline
        rows={2}
        size="small"
      />

      <TextField
        label="Additional Instructions"
        value={additionalInstructions}
        onChange={(e) => setAdditionalInstructions(e.target.value)}
        helperText="Additional instructions for processing documentation (e.g., 'Focus on API examples', 'Include migration guides')"
        multiline
        rows={3}
        size="small"
      />
    </Box>
  );
};

export default GitlabRepoForm;
