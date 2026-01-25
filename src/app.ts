import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';
import { isRedisAvailable } from './config/redis';

// Import v1 routes (New optimized structure)
import v1Routes from './routes/v1';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  const redisStatus = isRedisAvailable();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      redis: redisStatus ? 'connected' : 'disconnected',
    },
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Society Gate API is running');
});

// ============================================
// V1 API ROUTES
// ============================================
app.use('/api/v1', v1Routes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
