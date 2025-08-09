import React, { useState } from 'react';
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
import { Link as RouterLink } from 'react-router-dom';
import { useLibraries } from '../hooks/queries/useLibraries';
import { useDeleteLibrary } from '../hooks/mutations/useDeleteLibrary';
import { useDialog } from '../context/DialogProvider';
import AddDocsModal from '../components/AddDocsModal';
import LibraryStatsBadges from '../components/LibraryStatsBadges';

const HomePage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [addDocsModalOpen, setAddDocsModalOpen] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<{ id: string; name: string } | null>(null);
  const { showConfirm } = useDialog();

  const { data: libraries = [], isLoading: loading } = useLibraries();
  const { mutate: deleteLibrary, isPending: isDeleting } = useDeleteLibrary();

  const handleDeleteLibrary = (libraryId: string, libraryName: string) => {
    showConfirm(
      'Confirm Deletion',
      `Are you sure you want to delete the "${libraryName}" library and all its associated data? This action cannot be undone.`,
      () => {
        deleteLibrary(libraryId);
      },
    );
  };

  const handleAddResource = (libraryId: string, libraryName: string) => {
    setSelectedLibrary({ id: libraryId, name: libraryName });
    setAddDocsModalOpen(true);
  };

  const handleModalClose = () => {
    setAddDocsModalOpen(false);
    setSelectedLibrary(null);
  };

  const filteredLibraries = libraries.filter(
    (library) =>
      library.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      library.description?.toLowerCase().includes(searchTerm.toLowerCase()),
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
              <TableCell sx={{ width: 480, maxWidth: 480 }}>Description</TableCell>
              <TableCell>Statistics</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress />
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
                      to={`/library/${encodeURIComponent(row.libraryId)}`}
                      underline="always"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        width: 480,
                        maxWidth: 480,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.description || ''}
                    >
                      {row.description}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <LibraryStatsBadges libraryId={row.libraryId} size="small" />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      onClick={() => handleAddResource(row.libraryId, row.name)}
                    >
                      Add Resource
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      onClick={() =>
                        handleDeleteLibrary(row.libraryId, row.name)
                      }
                      disabled={isDeleting}
                      sx={{ ml: 1 }}
                    >
                      {isDeleting ? (
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

      <AddDocsModal
        open={addDocsModalOpen}
        onClose={handleModalClose}
        existingLibrary={selectedLibrary}
      />
    </Box>
  );
};

export default HomePage;
