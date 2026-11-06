import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/error.js';

import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/event.routes.js';
import adminRoutes from './routes/admin.routes.js';
import registrationRoutes from './routes/registration.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import resourceRoutes from './routes/resource.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);

// Logging (skip in test mode to keep test output clean)
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Request parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static files for posters with Cross-Origin-Resource-Policy
const postersDir = path.resolve(__dirname, '../uploads/posters');
app.use(
  '/uploads/posters',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(postersDir)
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ success: true });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/admin', adminRoutes);

// Placeholder mounts for upcoming phases will be attached here
// /api/events, /api/registrations, /api/attendance, /api/feedback, /api/resources, /api/admin

// 404 handler
app.use(notFound);

// Central error handler
app.use(errorHandler);

export default app;
