import express, { Request, Response } from 'express';
import {
  getCrawlJobStatus,
  deleteJob,
  processSingleJob,
  processAllJobs,
} from '../lib/jobs/service';

const router = express.Router();

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

// Process a single job item
router.post(
  '/process/single',
  async (
    req: Request<object, { id: string }>,
    res: Response,
  ): Promise<void> => {
    const { id } = req.body;
    console.warn('Processing job item', id);
    try {
      const result = await processSingleJob(parseInt(id, 10));
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

// Process all jobs for a specific library
router.post(
  '/process/all/:jobId',
  async (req: Request<{ jobId: string }>, res: Response): Promise<void> => {
    const { jobId } = req.params;
    try {
      const result = await processAllJobs(jobId);
      res.json(result);
    } catch (error) {
      console.error(`Failed to start all-job processing for ${jobId}:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

export default router;
