import React from 'react';
import { Typography, Tooltip, Box } from '@mui/material';
import { SourceTypeChip } from './SourceTypeChip';

interface SourceDisplayProps {
  source: string;
  sourceType: string;
  originUrl?: string | null;
}

export const SourceDisplay: React.FC<SourceDisplayProps> = ({
  source,
  sourceType,
  originUrl
}) => {
  // For gitlab-repo type, display the origin URL which is more meaningful
  // For web-scrape type, display the actual URL
  const displayUrl = sourceType === 'gitlab-repo' && originUrl
    ? originUrl
    : source;

  // Truncate long content for gitlab-repo type
  const truncateContent = (content: string, maxLength: number = 100) => {
    if (sourceType === 'gitlab-repo' && content.length > maxLength) {
      // For GitLab repos, just show a preview
      return content.substring(0, maxLength) + '...';
    }
    return content;
  };

  // Format GitLab origin URLs for better display
  const formatUrl = (url: string) => {
    if (url.startsWith('gitlab://')) {
      // gitlab://gitlab.com/group/project@ref/path/to/file.md
      // Convert to a more readable format
      const match = url.match(/gitlab:\/\/([^\/]+)\/([^@]+)@([^\/]+)\/(.+)/);
      if (match) {
        const [, , project, ref, path] = match;
        return `${project} → ${path} (${ref})`;
      }
    }
    return url;
  };

  const formattedUrl = formatUrl(displayUrl);
  const truncatedUrl = truncateContent(formattedUrl);
  const needsTooltip = formattedUrl !== truncatedUrl || formattedUrl !== displayUrl;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <SourceTypeChip sourceType={sourceType} />
      {needsTooltip ? (
        <Tooltip title={displayUrl}>
          <Typography
            variant="body2"
            sx={{
              wordBreak: 'break-all',
              cursor: 'help'
            }}
          >
            {truncatedUrl}
          </Typography>
        </Tooltip>
      ) : (
        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
          {truncatedUrl}
        </Typography>
      )}
    </Box>
  );
};
