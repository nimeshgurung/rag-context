import React from 'react';
import { Chip } from '@mui/material';
import { Link, Description, Code } from '@mui/icons-material';

interface SourceTypeChipProps {
  sourceType?: string;
}

export const SourceTypeChip: React.FC<SourceTypeChipProps> = ({ sourceType }) => {
  if (!sourceType) return null;

  // Map source types to display properties
  const getChipProps = () => {
    switch (sourceType) {
      case 'web-scrape':
        return {
          icon: <Link />,
          label: 'Web',
          color: 'primary' as const,
        };
      case 'gitlab-repo':
        return {
          icon: <Code />,
          label: 'GitLab',
          color: 'secondary' as const,
        };
      case 'api-spec':
        return {
          icon: <Description />,
          label: 'API',
          color: 'success' as const,
        };
      default:
        // Backward compatibility for old source types
        return {
          icon: <Link />,
          label: sourceType === 'url' ? 'URL' : 'Doc',
          color: 'default' as const,
        };
    }
  };

  const { icon, label, color } = getChipProps();

  return (
    <Chip
      icon={icon}
      label={label}
      size="small"
      variant="outlined"
      color={color}
      sx={{ mr: 1 }}
    />
  );
};
