import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Settings, Search, Work } from '@mui/icons-material';
import SearchTab from '../components/LibraryDetail/SearchTab';
import JobsTab from '../components/LibraryDetail/JobsTab';
import SettingsTab from '../components/LibraryDetail/SettingsTab';
import { getLibraries, getAllJobsForLibrary } from '../services/api';

interface Library {
  libraryId: string;
  name: string;
  description: string;
}

interface JobSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

const LibraryDetailPage: React.FC = () => {
  const { libraryId } = useParams<{ libraryId: string }>();
  const [searchParams] = useSearchParams();
  const fallbackId = searchParams.get('libraryid');
  const id = libraryId || fallbackId;

  const [activeTab, setActiveTab] = useState(0);
  const [library, setLibrary] = useState<Library | null>(null);
  const [jobSummary, setJobSummary] = useState<JobSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchLibraryData();
      fetchJobSummary();
    }
  }, [id]);

  const fetchLibraryData = async () => {
    try {
      const libraries = await getLibraries();
      const foundLibrary = libraries.find(lib => lib.libraryId === id);
      if (foundLibrary) {
        setLibrary(foundLibrary);
      } else {
        setError('Library not found');
      }
    } catch (err) {
      setError('Failed to load library data');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobSummary = async () => {
    if (!id) return;
    try {
      const jobsData = await getAllJobsForLibrary(id);
      // Calculate total summary across all batches
      const totalSummary = jobsData.batches.reduce(
        (acc, batch) => ({
          total: acc.total + batch.summary.total,
          pending: acc.pending + batch.summary.pending,
          processing: acc.processing + batch.summary.processing,
          completed: acc.completed + batch.summary.completed,
          failed: acc.failed + batch.summary.failed,
        }),
        { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
      );
      setJobSummary(totalSummary);
    } catch (err) {
      console.error('Failed to fetch job summary:', err);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getProgressPercentage = () => {
    if (!jobSummary || jobSummary.total === 0) return 0;
    return Math.round((jobSummary.completed / jobSummary.total) * 100);
  };

  const isProcessing = jobSummary && jobSummary.processing > 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !library) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Library not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Library Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {library.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {library.description}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {library.libraryId}
            </Typography>
          </Box>
        </Box>

        {/* Job Status Summary */}
        {jobSummary && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            mt: 2, 
            p: 2, 
            bgcolor: 'background.default', 
            borderRadius: 1 
          }}>
            {isProcessing && <CircularProgress size={20} />}
            <Typography variant="body2">
              Jobs: {jobSummary.completed}/{jobSummary.total} Complete ({getProgressPercentage()}%)
            </Typography>
            <Chip 
              label={`${jobSummary.completed} completed`} 
              color="success" 
              size="small" 
              variant="outlined" 
            />
            {jobSummary.processing > 0 && (
              <Chip 
                label={`${jobSummary.processing} processing`} 
                color="info" 
                size="small" 
                variant="outlined" 
              />
            )}
            {jobSummary.pending > 0 && (
              <Chip 
                label={`${jobSummary.pending} pending`} 
                color="warning" 
                size="small" 
                variant="outlined" 
              />
            )}
            {jobSummary.failed > 0 && (
              <Chip 
                label={`${jobSummary.failed} failed`} 
                color="error" 
                size="small" 
                variant="outlined" 
              />
            )}
          </Box>
        )}
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          aria-label="library detail tabs"
        >
          <Tab 
            icon={<Search />} 
            label="Search & Results" 
            iconPosition="start"
          />
          <Tab 
            icon={<Work />} 
            label={`Jobs${jobSummary ? ` (${jobSummary.total})` : ''}`}
            iconPosition="start"
          />
          <Tab 
            icon={<Settings />} 
            label="Settings" 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box>
        {activeTab === 0 && <SearchTab libraryId={id!} />}
        {activeTab === 1 && <JobsTab libraryId={id!} onJobsUpdate={fetchJobSummary} />}
        {activeTab === 2 && <SettingsTab library={library} />}
      </Box>
    </Box>
  );
};

export default LibraryDetailPage;
