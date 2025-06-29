import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  searchLibraries,
  fetchLibraryDocumentation,
  getUniqueLibraries,
  addDocumentationSource,
} from './lib/api';
import { DocumentationSource } from './lib/types';
import { addClient, removeClient } from './lib/events';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/libraries', async (_req: Request, res: Response) => {
  try {
    const libraries = await getUniqueLibraries();
    res.json(libraries);
  } catch (error) {
    console.error('Failed to fetch unique libraries:', error);
    res.status(500).json({ error: 'Failed to fetch unique libraries' });
  }
});

app.post('/api/search', async (req: Request, res: Response) => {
  const { libraryName } = req.body;
  if (!libraryName) {
    res.status(400).json({ error: 'libraryName is required' });
    return;
  }
  try {
    const results = await searchLibraries(libraryName);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search for libraries' });
  }
});

app.post('/api/docs', async (req: Request, res: Response) => {
  const { libraryId, topic } = req.body;
  if (!libraryId) {
    res.status(400).json({ error: 'libraryId is required' });
    return;
  }
  try {
    const docs = await fetchLibraryDocumentation(libraryId, { topic });
    res.json({ documentation: docs });
  } catch (error) {
    console.error('Docs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch library documentation' });
  }
});

app.post('/api/libraries/add-source', async (req: Request, res: Response) => {
  const source = req.body as DocumentationSource;

  if (!source || !source.type) {
    res.status(400).json({ error: 'Invalid source data' });
    return;
  }

  const jobId = uuidv4();

  // Don't await, let it run in the background
  addDocumentationSource(jobId, source);

  res.status(202).json({ jobId });
});

app.get('/api/jobs/:jobId/events', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addClient(jobId, res);

  req.on('close', () => {
    removeClient(jobId);
    res.end();
  });
});

app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});
