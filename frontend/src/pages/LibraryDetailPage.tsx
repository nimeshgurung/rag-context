import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { Search, Work, Add, Delete } from '@mui/icons-material';
import SearchTab from '../components/LibraryDetail/SearchTab';
import JobsTab from '../components/LibraryDetail/JobsTab';
import { getLibraries, getAllJobsForLibrary, deleteLibrary } from '../services/api';
import AddDocsModal from '../components/AddDocsModal';
import { useDialog } from '../context/DialogProvider';
import { useNavigate } from 'react-router-dom';

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

  const [addDocsModalOpen, setAddDocsModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showDialog, showConfirm } = useDialog();
  const navigate = useNavigate();

  const fetchLibraryData = useCallback(async () => {
    try {
      const libraries = await getLibraries();
      const foundLibrary = libraries.find(lib => lib.libraryId === id);
      if (foundLibrary) {
        setLibrary(foundLibrary);
      } else {
        setError('Library not found');
      }
    } catch (err) {
      setError('Failed to load library data: ' + (err as Error)?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchJobSummary = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchLibraryData();
      fetchJobSummary();
    }
  }, [id, fetchJobSummary, fetchLibraryData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddResource = () => {
    setAddDocsModalOpen(true);
  };

  const handleModalClose = () => {
    setAddDocsModalOpen(false);
    // Refresh job data after adding resource
    fetchJobSummary();
  };

  const handleDeleteLibrary = async () => {
    if (!library) return;

    showConfirm(
      'Confirm Deletion',
      `Are you sure you want to delete the "${library.name}" library and all its associated data? This action cannot be undone.`,
      async () => {
        setDeleting(true);
        try {
          await deleteLibrary(library.libraryId);
          showDialog('Success', 'Library deleted successfully.');
          navigate('/'); // Redirect to home
        } catch (error) {
          console.error('Failed to delete library', error);
          showDialog('Error', 'Could not delete the library.');
        } finally {
          setDeleting(false);
        }
      },
    );
  };



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
          <Box sx={{ display: 'flex', gap: 2, ml: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddResource}
            >
              Add Resource
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleDeleteLibrary}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Library'}
            </Button>
          </Box>
        </Box>
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
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box>
        {activeTab === 0 && <SearchTab libraryId={id!} />}
        {activeTab === 1 && <JobsTab libraryId={id!} onJobsUpdate={fetchJobSummary} />}
      </Box>

      {/* Add Docs Modal */}
      <AddDocsModal
        open={addDocsModalOpen}
        onClose={handleModalClose}
        existingLibrary={{ id: library.libraryId, name: library.name }}
      />
    </Box>
  );
};

export default LibraryDetailPage;
