import express, { Request, Response } from 'express';
import cors from 'cors';

// Import route modules
import librariesRoutes from './routes/libraries.js';
import documentationRoutes from './routes/documentation.js';
import jobsRoutes from './routes/jobs.js';
import eventsRoutes from './routes/events.js';
import { jobService } from './lib/jobs/jobService.js';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/libraries', librariesRoutes);
app.use('/api/documentation', documentationRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/events', eventsRoutes);

// Test route
app.get('/api/test', (req: Request, res: Response) => {
  res.send('Test route is working');
});

app.post('/api/search', (req: Request, res: Response) => {
  // Redirect to the new /search endpoint
  req.url = '/search';
  librariesRoutes(req, res, () => {});
});

const server = app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Shutdown child process manager first
    const { childProcessManager } = await import(
      './lib/jobs/childProcessManager'
    );
    await childProcessManager.shutdown();

    // Shutdown job service
    jobService.shutdown();

    // Close server
    server.close((err) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }

      console.log('Server closed successfully.');
      process.exit(0);
    });

    // Force exit after 15 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Graceful shutdown timeout. Forcing exit...');
      process.exit(1);
    }, 15000);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
