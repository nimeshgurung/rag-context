import express from 'express';
import cors from 'cors';
import {
  searchLibraries,
  fetchLibraryDocumentation,
  getUniqueLibraries,
} from './lib/api';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/libraries', async (_req, res) => {
  try {
    const libraries = await getUniqueLibraries();
    res.json(libraries);
  } catch (error) {
    console.error('Failed to fetch unique libraries:', error);
    res.status(500).json({ error: 'Failed to fetch unique libraries' });
  }
});

app.post('/api/search', async (req, res) => {
  const { libraryName } = req.body;
  if (!libraryName) {
    return res.status(400).json({ error: 'libraryName is required' });
  }
  try {
    const results = await searchLibraries(libraryName);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search for libraries' });
  }
});

app.post('/api/docs', async (req, res) => {
  const { libraryId, topic } = req.body;
  if (!libraryId) {
    return res.status(400).json({ error: 'libraryId is required' });
  }
  try {
    const docs = await fetchLibraryDocumentation(libraryId, { topic });
    res.json({ documentation: docs });
  } catch (error) {
    console.error('Docs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch library documentation' });
  }
});

app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});