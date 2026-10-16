import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config/index.js';
import apiRouter from './routes/index.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

const app = express();

// Security headers
app.use(helmet());

// CORS — allows web and future mobile clients
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));

// API routes
app.use('/api', apiRouter);

// 404 for unmatched API routes
app.all('/api/*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Serve static frontend assets (CSS, JS, images)
app.use(express.static(publicDir));

// SPA fallback — serve index.html for all non-API routes so React Router handles routing
app.get('*', (req, res) => {
  res.sendFile(join(publicDir, 'index.html'));
});

// Centralized error handler
app.use(errorHandler);

export default app;
