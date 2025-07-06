import express, { Request, Response } from 'express';
import {
  getCrawlJobStatus,
  reprocessJob,
  deleteJob,
  processSingleJob,
  processAllJobs,
  startCrawlJob,
} from '../lib/api';

const router = express.Router();

interface StartCrawlRequestBody {
  startUrl: string;
  libraryName: string;
  libraryDescription?: string;
}

// Start a crawl job
router.post(
  '/start',
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

// Get crawl job status
router.get(
  '/status/:jobId',
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

// Reprocess a job
router.post(
  '/reprocess',
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

// Delete a job
router.delete(
  '/job/:id',
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

// Process a single job
router.post(
  '/process/single',
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

// Process all jobs
router.post(
  '/process/all',
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

export default router;