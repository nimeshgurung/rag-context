import express, { Request, Response } from 'express';
import cors from 'cors';

// Import route modules
import librariesRoutes from './routes/libraries.js';
import documentationRoutes from './routes/documentation.js';
import jobsRoutes from './routes/jobs.js';
import eventsRoutes from './routes/events.js';

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

app.listen(port, () => {
  console.log(`Express server listening on http://localhost:${port}`);
});
