import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { RedisStore } from 'rate-limit-redis';
import { errorHandler } from './middlewares/error.middleware';
import { redis, isRedisAvailable } from './config/redis';
import { prisma } from './utils/Client';
import logger from './utils/logger';
import { JWT_ALGORITHM, USER_TOKEN_AUDIENCE } from './services/token.service';
import { verifyStaffToken } from './modules/staff-app/staff-app.token';

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

// The general API limiter counts per VERIFIED user (access token signature + audience +
// type checked, no DB hit) instead of per IP, so guards sharing one gate NAT do not
// block each other and a polling guard app does not exhaust a shared IP budget.
// Requests without a valid token fall back to the IP and the low limit.
const VERIFIED_USER_LIMIT = 1500;
const ANONYMOUS_LIMIT = 200;
const rateLimitIdentities = new WeakMap<express.Request, string | null>();

const verifiedRateLimitKey = (req: express.Request): string | null => {
  if (rateLimitIdentities.has(req)) return rateLimitIdentities.get(req)!;
  let key: string | null = null;
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        algorithms: [JWT_ALGORITHM],
        audience: USER_TOKEN_AUDIENCE,
      }) as { userId?: unknown; type?: unknown };
      if (decoded.type === 'access' && typeof decoded.userId === 'string' && decoded.userId) {
        key = `u:${decoded.userId}`;
      }
    } catch {
      // Not a user token — it may be a staff-app token (own audience), checked next
    }
    if (!key) {
      try {
        key = `s:${verifyStaffToken(token, 'access').staffAccountId}`;
      } catch {
        key = null; // invalid, expired or wrong secret: treated as anonymous
      }
    }
  }
  rateLimitIdentities.set(req, key);
  return key;
};

// Rate limiting - general API (per verified user, per IP otherwise)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (verifiedRateLimitKey(req) ? VERIFIED_USER_LIMIT : ANONYMOUS_LIMIT),
  keyGenerator: (req) => verifiedRateLimitKey(req) ?? ipKeyGenerator(req.ip ?? ''),
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
