import express, { Request, Response } from 'express';
import {
  searchLibraries,
  getUniqueLibraries,
  getLatestJobForLibrary,
  deleteLibrary,
} from '../lib/api';
import { DocumentationSource } from '../lib/types';
import { addDocumentationSource } from '../lib/ingestion';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all libraries
router.get('/', async (_req: Request, res: Response) => {
  try {
    const libraries = await getUniqueLibraries();
    res.json(libraries);
  } catch (error) {
    console.error('Failed to fetch unique libraries:', error);
    res.status(500).json({ error: 'Failed to fetch unique libraries' });
  }
});

// Search for libraries
router.post('/search', async (req: Request, res: Response) => {
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

// Add documentation source (creates new library)
router.post('/add-source', async (req: Request, res: Response) => {
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

// Add resource to existing library
router.post(
  '/:libraryId/add-resource',
  async (req: Request<{ libraryId: string }>, res: Response): Promise<void> => {
    const { libraryId } = req.params;
    const source = req.body as DocumentationSource;

    if (!source || !source.type) {
      res.status(400).json({ error: 'Invalid source data' });
      return;
    }

    const jobId = uuidv4();

    // Don't await, let it run in the background
    addDocumentationSource(jobId, source, libraryId);

    res.status(202).json({ jobId });
  },
);

// Get latest job for a library
router.get(
  '/:libraryId/latest-job',
  async (req: Request<{ libraryId: string }>, res: Response): Promise<void> => {
    const { libraryId } = req.params;
    try {
      const result = await getLatestJobForLibrary(libraryId);
      res.json(result);
    } catch (error) {
      console.error(
        `Failed to get latest job for library ${libraryId}:`,
        error,
      );
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

// Delete a library
router.delete(
  '/:libraryId',
  async (req: Request<{ libraryId: string }>, res: Response): Promise<void> => {
    const { libraryId } = req.params;
    try {
      const result = await deleteLibrary(libraryId);
      res.json(result);
    } catch (error) {
      console.error(`Failed to delete library ${libraryId}:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

export default router;
