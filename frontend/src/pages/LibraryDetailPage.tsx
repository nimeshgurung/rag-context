import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
import { useLibraries } from '../hooks/queries/useLibraries';
import { useLibraryJobs } from '../hooks/queries/useLibraryJobs';
import { useDeleteLibrary } from '../hooks/mutations/useDeleteLibrary';
import AddDocsModal from '../components/AddDocsModal';
import { useDialog } from '../context/DialogProvider';

const LibraryDetailPage: React.FC = () => {
  const { libraryId } = useParams<{ libraryId: string }>();
  const [searchParams] = useSearchParams();
  const fallbackId = searchParams.get('libraryid');
  const id = libraryId || fallbackId;

  const [activeTab, setActiveTab] = useState(0);
  const [addDocsModalOpen, setAddDocsModalOpen] = useState(false);
  const { showConfirm, showDialog } = useDialog();
  const navigate = useNavigate();

  const { data: libraries, isLoading: isLoadingLibraries } = useLibraries();
  const { data: jobsData, refetch: refetchJobs } = useLibraryJobs(id!);
  const { mutate: deleteLibrary, isPending: isDeleting } = useDeleteLibrary();

  const library = useMemo(
    () => libraries?.find((lib) => lib.libraryId === id),
    [libraries, id]
  );

  const jobSummary = useMemo(() => {
    if (!jobsData) return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    return jobsData.batches.reduce(
      (acc, batch) => ({
        total: acc.total + batch.summary.total,
        pending: acc.pending + batch.summary.pending,
        processing: acc.processing + batch.summary.processing,
        completed: acc.completed + batch.summary.completed,
        failed: acc.failed + batch.summary.failed,
      }),
      { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    );
  }, [jobsData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleAddResource = () => {
    setAddDocsModalOpen(true);
  };

  const handleModalClose = () => {
    setAddDocsModalOpen(false);
    refetchJobs();
  };

  const handleDeleteLibrary = () => {
    if (!library) return;

    showConfirm(
      'Confirm Deletion',
      `Are you sure you want to delete the "${library.name}" library and all its associated data? This action cannot be undone.`,
      () => {
        deleteLibrary(library.libraryId, {
          onSuccess: () => {
            showDialog('Success', 'Library deleted successfully.');
            navigate('/');
          },
          onError: () => {
            showDialog('Error', 'Could not delete the library.');
          },
        });
      }
    );
  };

  if (isLoadingLibraries) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!library) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Library not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Library Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
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
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Library'}
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
        {activeTab === 1 && <JobsTab libraryId={id!} />}
      </Box>

      {/* Add Docs Modal */}
      <AddDocsModal
        open={addDocsModalOpen}
        onClose={handleModalClose}
        existingLibrary={library ? { id: library.libraryId, name: library.name } : null}
        activeTab={activeTab}
      />
    </Box>
  );
};

export default LibraryDetailPage;
