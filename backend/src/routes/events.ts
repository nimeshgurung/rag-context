import express, { Request, Response } from 'express';
import { addClient, removeClient } from '../lib/events';

const router = express.Router();

// Generic SSE endpoint that supports both jobs and libraries
router.get(
  '/:resourceType/:resourceId/events',
  (req: Request, res: Response) => {
    const { resourceType, resourceId } = req.params;

    // Validate resource type
    if (!['job', 'library'].includes(resourceType)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection event
    res.write(
      `data: ${JSON.stringify({ type: 'connected', resourceType, resourceId })}\n\n`,
    );

    // Register this client
    addClient(resourceId, res);

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(resourceId, res);
    });
  },
);

export default router;
