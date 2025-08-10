import express, { Request, Response } from 'express';
import {
  getCrawlJobStatus,
  deleteJob,
  processSingleJob,
  processAllJobs,
  processSelected,
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

// Process a single job item (requeue and trigger batch child worker)
router.post(
  '/process/single',
  async (
    req: Request<object, { id: string }>,
    res: Response,
  ): Promise<void> => {
    const { id } = req.body;
    console.warn('Requeue+start job item', id);
    try {
      const result = await processSingleJob(parseInt(id, 10));
      if (result.statusCode) {
        res.status(result.statusCode).json(result);
      } else {
        res.json(result);
      }
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

      // Handle different status codes based on capacity control
      if (result.statusCode) {
        res.status(result.statusCode).json(result);
      } else {
        res.json(result);
      }
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

// Process selected job items (requeue and trigger child worker for the batch)
router.post(
  '/process/selected',
  async (
    req: Request<object, { jobId: string; ids: number[] }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { jobId, ids } = req.body as { jobId: string; ids: number[] };
      if (!jobId || !Array.isArray(ids)) {
        res.status(400).json({ success: false, message: 'jobId and ids[] required' });
        return;
      }
      const result = await processSelected(jobId, ids);
      if (result.statusCode) {
        res.status(result.statusCode).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      console.error('Failed to process selected jobs:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  },
);

export default router;
