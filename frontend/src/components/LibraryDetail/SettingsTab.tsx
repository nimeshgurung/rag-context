import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
} from '@mui/material';
import { Add, Delete, Web, Code } from '@mui/icons-material';
import AddDocsModal from '../AddDocsModal';
import { useDialog } from '../../context/DialogProvider';
import { deleteLibrary } from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface Library {
  libraryId: string;
  name: string;
  description: string;
}

interface SettingsTabProps {
  library: Library;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ library }) => {
  const [addDocsModalOpen, setAddDocsModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { showDialog, showConfirm } = useDialog();
  const navigate = useNavigate();

  const handleAddResource = () => {
    setAddDocsModalOpen(true);
  };

  const handleModalClose = () => {
    setAddDocsModalOpen(false);
    // Note: The modal handles refreshing job data through events
  };

  const handleDeleteLibrary = async () => {
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

  return (
    <Box>
      {/* Library Information */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Library Information
        </Typography>
        
        <TextField
          fullWidth
          label="Library Name"
          value={library.name}
          InputProps={{ readOnly: true }}
          sx={{ mb: 2 }}
          variant="outlined"
        />
        
        <TextField
          fullWidth
          label="Description"
          value={library.description}
          InputProps={{ readOnly: true }}
          sx={{ mb: 2 }}
          variant="outlined"
          multiline
          rows={2}
        />
        
        <TextField
          fullWidth
          label="Library ID"
          value={library.libraryId}
          InputProps={{ readOnly: true }}
          variant="outlined"
          helperText="Unique identifier for this library"
        />
      </Paper>

      {/* Resource Management */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Resource Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add new documentation sources, API specifications, or web content to this library.
        </Typography>
        
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddResource}
          sx={{ mb: 2 }}
        >
          Add New Resource
        </Button>

        <List>
          <ListItem>
            <ListItemIcon>
              <Web />
            </ListItemIcon>
            <ListItemText
              primary="Web Documentation"
              secondary="Scrape documentation websites and add them to this library"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Code />
            </ListItemIcon>
            <ListItemText
              primary="API Specifications"
              secondary="Upload OpenAPI/Swagger specs or other API documentation"
            />
          </ListItem>
        </List>
      </Paper>

      {/* Library Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Library Settings
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Library settings allow you to configure how this library processes and stores documentation.
            More settings will be available in future updates.
          </Typography>
        </Alert>

        {/* Future settings can go here */}
        <Typography variant="body2" color="text.secondary">
          • Auto-processing: Enabled
          <br />
          • Embedding model: Default
          <br />
          • Chunk size: Default
        </Typography>
      </Paper>

      {/* Danger Zone */}
      <Paper sx={{ p: 3, border: '1px solid', borderColor: 'error.main' }}>
        <Typography variant="h6" gutterBottom color="error">
          Danger Zone
        </Typography>
        
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Deleting a library will permanently remove all associated documentation, 
            embeddings, and processing jobs. This action cannot be undone.
          </Typography>
        </Alert>
        
        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          onClick={handleDeleteLibrary}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Library'}
        </Button>
      </Paper>

      {/* Add Docs Modal */}
      <AddDocsModal
        open={addDocsModalOpen}
        onClose={handleModalClose}
        existingLibrary={{ id: library.libraryId, name: library.name }}
      />
    </Box>
  );
};

export default SettingsTab;