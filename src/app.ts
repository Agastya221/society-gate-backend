import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';
import { isRedisAvailable } from './config/redis';
import { prisma } from './utils/Client';

// Import v1 routes (New optimized structure)
import v1Routes from './routes/v1';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Comprehensive health check
app.get('/health', async (_req, res) => {
  const startTime = Date.now();

  // Check Redis
  const redisStatus = isRedisAvailable();

  // Check Database
  let dbStatus = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  const responseTime = Date.now() - startTime;
  const isHealthy = dbStatus; // DB is critical, Redis is optional

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    responseTime: `${responseTime}ms`,
    services: {
      api: 'healthy',
      database: dbStatus ? 'connected' : 'disconnected',
      redis: redisStatus ? 'connected' : 'disconnected',
    },
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.send('Society Gate API is running');
});

// ============================================
// V1 API ROUTES
// ============================================
app.use('/api/v1', v1Routes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
