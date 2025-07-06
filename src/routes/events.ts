import express, { Request, Response } from 'express';
import { addClient, removeClient } from '../lib/events';

const router = express.Router();

// Server-Sent Events endpoint for job progress
router.get('/:jobId/events', (req: Request, res: Response) => {
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

export default router;
