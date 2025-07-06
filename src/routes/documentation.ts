import express, { Request, Response } from 'express';
import { fetchLibraryDocumentation } from '../lib/api';

const router = express.Router();

// Fetch library documentation
router.post('/', async (req: Request, res: Response) => {
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

export default router;