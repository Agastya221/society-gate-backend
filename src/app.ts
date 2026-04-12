import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { errorHandler } from './middlewares/error.middleware';
import { redis, isRedisAvailable } from './config/redis';
import { prisma } from './utils/Client';
import logger from './utils/logger';

// Import v1 routes
import v1Routes from './routes/v1';

const app = express();

// Security headers
app.use(helmet());

// Request timeout — kill any request that hasn't responded in 25s
// Prevents hanging DB connections from blocking the client indefinitely
app.use((_req, res, next) => {
  res.setTimeout(25000, () => {
    res.status(503).json({ success: false, message: 'Request timed out. Please try again.' });
  });
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Reduced from 10mb to prevent memory exhaustion
app.use(express.urlencoded({ extended: true }));

// Redis store for rate limiting - handles connection failures gracefully
const createRedisStore = (prefix: string) =>
  new RedisStore({
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<any>,
    prefix: `rl:${prefix}:`,
  });

// Rate limiting - general API (increased limits)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Increased from 100
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  store: createRedisStore('api'),
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Increased from 20
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
  store: createRedisStore('auth'),
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth/', authLimiter);

// Comprehensive health check
app.get('/health', async (_req, res) => {
  const startTime = Date.now();

  const redisStatus = isRedisAvailable();

  let dbStatus = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
  }

  const responseTime = Date.now() - startTime;
  const isHealthy = dbStatus;

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

// V1 API ROUTES
app.use('/api/v1', v1Routes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
