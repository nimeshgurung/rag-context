import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  searchLibraries,
  fetchLibraryDocumentation,
  getUniqueLibraries,
  getCrawlJobStatus,
  reprocessJob,
  deleteJob,
  processSingleJob,
  processAllJobs,
  getLatestJobForLibrary,
  deleteLibrary,
  startCrawlJob,
} from './lib/api';
import { DocumentationSource } from './lib/types';
import { addClient, removeClient } from './lib/events';
import { v4 as uuidv4 } from 'uuid';
import { addDocumentationSource } from './lib/ingestion';

const app = express();
const port = process.env.PORT || 3001;

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

interface StartCrawlRequestBody {
  startUrl: string;
  libraryName: string;
  libraryDescription?: string;
}

app.post(
  '/api/crawl/start',
  (req: Request<object, object, StartCrawlRequestBody>, res: Response) => {
    startCrawlJob(
      req.body.libraryName,
      req.body.libraryDescription || '',
      req.body.startUrl,
    )
      .then((jobId) => {
        res.status(202).json({ jobId });
      })
      .catch((error) => {
        console.error('Failed to start crawl job:', error);
        res.status(500).json({ error: 'Failed to start crawl job' });
      });
  },
);

app.get(
  '/api/crawl/status/:jobId',
  (req: Request<{ jobId: string }>, res: Response) => {
    getCrawlJobStatus(req.params.jobId)
      .then((status) => {
        res.json(status);
      })
      .catch((error) => {
        console.error(
          `Failed to get status for job ${req.params.jobId}:`,
          error,
        );
        res.status(500).json({ error: 'Failed to get job status' });
      });
  },
);

app.post(
  '/api/crawl/reprocess',
  async (
    req: Request<object, object, { id: number }>,
    res: Response,
  ): Promise<void> => {
    const jobItemId = req.body.id;
    try {
      const result = await reprocessJob(jobItemId);
      res.json(result);
    } catch (error) {
      console.error(`Failed to reprocess job item ${jobItemId}:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

app.delete(
  '/api/crawl/job/:id',
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const jobItemId = parseInt(req.params.id, 10);
    try {
      const result = await deleteJob(jobItemId);
      res.json(result);
    } catch (error) {
      console.error(`Failed to delete job item ${jobItemId}:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

app.post(
  '/api/crawl/process/single',
  async (
    req: Request<object, object, { id: number }>,
    res: Response,
  ): Promise<void> => {
    const { id } = req.body;
    console.warn('Processing job item', id);
    try {
      const result = await processSingleJob(id);
      res.json(result);
    } catch (error) {
      console.error(`Failed to process job item ${id}:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

app.post(
  '/api/crawl/process/all',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await processAllJobs();
      res.json(result);
    } catch (error) {
      console.error('Failed to start all-job processing:', error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

app.get(
  '/api/libraries/:libraryId/latest-job',
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

app.delete(
  '/api/libraries/:libraryId',
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

app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});
