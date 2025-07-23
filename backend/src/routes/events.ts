import express, { Request, Response } from 'express';

const router = express.Router();

// Server-Sent Events endpoint - DISABLED in favor of polling
router.get('/:jobId/events', (req: Request, res: Response) => {
  res.status(410).json({
    error:
      'SSE is disabled. Please use polling on the status endpoint instead.',
  });
});

export default router;
