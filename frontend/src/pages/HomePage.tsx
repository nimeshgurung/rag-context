import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Link, Typography, Box } from '@mui/material';
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Popular Libraries
      </Typography>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
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
              libraries.map((row) => (
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