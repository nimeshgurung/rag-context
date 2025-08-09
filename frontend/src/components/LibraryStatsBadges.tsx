import React from 'react';
import { Box, Chip, Skeleton, Tooltip } from '@mui/material';
import {
  Token as TokenIcon,
  Code as CodeIcon,
  DataObject as ChunksIcon
} from '@mui/icons-material';
import { useLibraryStats, useShouldShowLibraryStats } from '../hooks/queries/useLibraryStats';

interface LibraryStatsBadgesProps {
  libraryId: string;
  size?: 'small' | 'medium';
}

/**
 * Component that displays library statistics badges for tokens, snippets, and chunks.
 * Only shows for libraries with GitLab/WebScrape content.
 */
const LibraryStatsBadges: React.FC<LibraryStatsBadgesProps> = ({
  libraryId,
  size = 'medium'
}) => {
  const { data: stats, isLoading, isError } = useLibraryStats(libraryId);
  const shouldShow = useShouldShowLibraryStats(libraryId);

  // Don't render anything if we shouldn't show stats or if there's an error
  if (!shouldShow || isError) {
    return null;
  }

  // Show skeletons while loading
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Tooltip title="Total tokens from GitLab/WebScrape content">
        <Chip
          icon={<TokenIcon />}
          label={`${formatNumber(stats?.totalTokens || 0)} tokens`}
          size={size}
          variant="outlined"
          color="primary"
          sx={{
            fontSize: size === 'small' ? '0.75rem' : '0.875rem',
            fontWeight: 500,
          }}
        />
      </Tooltip>

      <Tooltip title="Total code/text snippets from GitLab/WebScrape content">
        <Chip
          icon={<CodeIcon />}
          label={`${formatNumber(stats?.totalSnippets || 0)} snippets`}
          size={size}
          variant="outlined"
          color="secondary"
          sx={{
            fontSize: size === 'small' ? '0.75rem' : '0.875rem',
            fontWeight: 500,
          }}
        />
      </Tooltip>

      <Tooltip title="Total content chunks from GitLab/WebScrape content">
        <Chip
          icon={<ChunksIcon />}
          label={`${formatNumber(stats?.totalChunks || 0)} chunks`}
          size={size}
          variant="outlined"
          color="info"
          sx={{
            fontSize: size === 'small' ? '0.75rem' : '0.875rem',
            fontWeight: 500,
          }}
        />
      </Tooltip>
    </Box>
  );
};

export default LibraryStatsBadges;

