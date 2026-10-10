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

// Render runs the app behind a proxy; trust the first hop so rate limiting
// can use the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

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

// CORS: the Expo apps are native clients and send no Origin header, so requests
// without an Origin are allowed. Browser origins are allowed only when listed in
// CLIENT_URL / ALLOWED_ORIGINS (comma-separated, both optional); any other browser
// origin gets no CORS headers, so the browser blocks the response.
const allowedOrigins = new Set(
  [process.env.CLIENT_URL, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
}));

// Only the payment webhook needs the exact raw bytes (signature verification);
// don't keep a second copy of every JSON body in memory.
const RAW_BODY_PATHS = ['/api/v1/payments/cashfree/webhook'];

app.use(express.json({
  limit: '1mb', // Reduced from 10mb to prevent memory exhaustion
  verify: (req, _res, buf) => {
    const url = ((req as express.Request).originalUrl || req.url || '').split('?')[0];
    if (RAW_BODY_PATHS.includes(url)) {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

const useRedisRateLimit =
  process.env.NODE_ENV === 'production' &&
  Boolean(process.env.REDIS_URL);

// Production instances share limits through Redis. Development uses the
// express-rate-limit memory store so the API remains usable without Redis.
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
  ...(useRedisRateLimit ? { store: createRedisStore('api') } : {}),
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Increased from 20
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
  ...(useRedisRateLimit ? { store: createRedisStore('auth') } : {}),
});

app.use('/api/', apiLimiter);
app.use('/api/v1/auth/', authLimiter);
// /api/v1/users is an alias of the auth router, and the staff app has its own
// OTP login — rate limit their login/refresh endpoints the same way.
app.use(
  [
    '/api/v1/users/otp',
    '/api/v1/users/admin-app/otp',
    '/api/v1/users/guard-app/otp',
    '/api/v1/users/refresh-token',
    '/api/v1/users/bootstrap-superadmin',
    '/api/v1/staff-app/auth',
  ],
  authLimiter
);

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
