import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link,
  Typography,
  Box,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  getLibraries,
  getLatestJobForLibrary,
  deleteLibrary,
} from '../services/api';
import { useDialog } from '../context/DialogProvider';

interface Library {
  libraryId: string;
  name: string;
  description: string;
  similarityScore: number;
}

const HomePage: React.FC = () => {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingJobId, setCheckingJobId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showDialog, showConfirm } = useDialog();

  const fetchLibraries = useCallback(async () => {
    try {
      setLoading(true);
      const results = await getLibraries();
      setLibraries(results);
    } catch (error) {
      console.error('Failed to fetch libraries', error);
      showDialog('Error', 'Failed to fetch libraries.');
    } finally {
      setLoading(false);
    }
  }, [showDialog]);

  useEffect(() => {
    fetchLibraries();

    const handleLibraryAdded = () => {
      console.log('New library added, refetching list...');
      fetchLibraries();
    };

    window.addEventListener('library-added', handleLibraryAdded);

    return () => {
      window.removeEventListener('library-added', handleLibraryAdded);
    };
  }, [fetchLibraries]);

  const handleViewLastJob = async (libraryId: string) => {
    setCheckingJobId(libraryId);
    try {
      const { jobId } = await getLatestJobForLibrary(libraryId);
      if (jobId) {
        navigate(`/jobs/${jobId}`);
      } else {
        showDialog('No Job Found', 'No job found for this library.');
      }
    } catch (error) {
      console.error('Failed to get latest job', error);
      showDialog('Error', 'Could not retrieve job information.');
    } finally {
      setCheckingJobId(null);
    }
  };

  const handleDeleteLibrary = async (
    libraryId: string,
    libraryName: string,
  ) => {
    showConfirm(
      'Confirm Deletion',
      `Are you sure you want to delete the "${libraryName}" library and all its associated data? This action cannot be undone.`,
      async () => {
        setDeletingId(libraryId);
        try {
          await deleteLibrary(libraryId);
          fetchLibraries(); // Refresh the list
        } catch (error) {
          console.error('Failed to delete library', error);
          showDialog('Error', 'Could not delete the library.');
        } finally {
          setDeletingId(null);
        }
      },
    );
  };

  const filteredLibraries = libraries.filter(
    (library) =>
      library.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      library.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Indexed Libraries and Documentation
      </Typography>
      <Box sx={{ mb: 2, mt: 2, maxWidth: '400px' }}>
        <TextField
          fullWidth
          label="Search Libraries"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
        />
      </Box>
      <TableContainer component={Paper}>
        <Table sx={{ width: '100%' }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>ID</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              filteredLibraries.map((row) => (
                <TableRow
                  key={row.libraryId}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    <Link
                      component={RouterLink}
                      to={`/library?libraryid=${encodeURIComponent(row.libraryId)}`}
                      underline="always"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>{row.libraryId}</TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleViewLastJob(row.libraryId)}
                      disabled={checkingJobId === row.libraryId}
                    >
                      {checkingJobId === row.libraryId ? (
                        <CircularProgress size={20} />
                      ) : (
                        'View Jobs'
                      )}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={() =>
                        handleDeleteLibrary(row.libraryId, row.name)
                      }
                      disabled={deletingId === row.libraryId}
                      sx={{ ml: 1 }}
                    >
                      {deletingId === row.libraryId ? (
                        <CircularProgress size={20} />
                      ) : (
                        'Delete'
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default HomePage;
