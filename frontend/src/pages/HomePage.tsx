import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Link, Typography, Box, TextField } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getLibraries } from '../services/api';

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

  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        setLoading(true);
        const results = await getLibraries();
        setLibraries(results);
      } catch (error) {
        console.error('Failed to fetch libraries', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLibraries();
  }, []);

  const filteredLibraries = libraries.filter(library =>
    library.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    library.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Indexed Libraries and Documentation
      </Typography>
      <Box sx={{ mb: 2, mt: 2, maxWidth: '400px'}}>
        <TextField
          fullWidth
          label="Search Libraries"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size='small'
        />
      </Box>
      <TableContainer component={Paper}>
        <Table sx={{ width: '100%' }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Loading...</TableCell>
              </TableRow>
            ) : (
              filteredLibraries.map((row) => (
              <TableRow
                key={row.libraryId}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <Link component={RouterLink} to={`/library?libraryid=${encodeURIComponent(row.libraryId)}`} underline="always">{row.name}</Link>
                </TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell>{row.libraryId}</TableCell>
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