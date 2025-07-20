import express, { Request, Response } from 'express';
import cors from 'cors';

// Import route modules
import librariesRoutes from './routes/libraries.js';
import documentationRoutes from './routes/documentation.js';
import crawlRoutes from './routes/crawl.js';
import eventsRoutes from './routes/events.js';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Route handlers
app.use('/api/libraries', librariesRoutes);
app.use('/api/docs', documentationRoutes);
app.use('/api/crawl', crawlRoutes);
app.use('/api/jobs', eventsRoutes);

app.post('/api/search', (req: Request, res: Response) => {
  // Redirect to the new /search endpoint
  req.url = '/search';
  librariesRoutes(req, res, () => {});
});

app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});
