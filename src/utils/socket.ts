import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from './Client';
import logger from './logger';

let io: Server | null = null;

export const SOCKET_EVENTS = {
  NOTIFICATION: 'notification',
  EMERGENCY_ALERT: 'emergency-alert',
  EMERGENCY_UPDATE: 'emergency-update',
  ENTRY_REQUEST_STATUS: 'entry-request-status',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    societyId?: string;
    flatId?: string;
  };
}

// NICE-6: Per-socket rate limiting
const socketRateLimits = new Map<string, { count: number; resetAt: number }>();
const SOCKET_RATE_LIMIT = 60; // max events per window
const SOCKET_RATE_WINDOW = 60_000; // 1 minute

function checkSocketRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = socketRateLimits.get(socketId);

  if (!entry || now > entry.resetAt) {
    socketRateLimits.set(socketId, { count: 1, resetAt: now + SOCKET_RATE_WINDOW });
    return true;
  }

  entry.count++;
  if (entry.count > SOCKET_RATE_LIMIT) {
    return false;
  }
  return true;
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of socketRateLimits) {
    if (now > entry.resetAt) {
      socketRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function initializeSocketIO(httpServer: HttpServer): Server {
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
    : undefined;

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          role: true,
          societyId: true,
          flatId: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = {
        id: user.id,
        role: user.role,
        societyId: user.societyId || undefined,
        flatId: user.flatId || undefined,
      };

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({ userId: socket.user?.id, role: socket.user?.role }, 'Socket user connected');

    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }
    if (socket.user?.societyId) {
      socket.join(`society:${socket.user.societyId}`);
    }
    if (socket.user?.flatId) {
      socket.join(`flat:${socket.user.flatId}`);
    }

    // NICE-6: Rate limit incoming events
    socket.use(([_event], next) => {
      if (!checkSocketRateLimit(socket.id)) {
        logger.warn({ socketId: socket.id, userId: socket.user?.id }, 'Socket rate limit exceeded');
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });

    socket.on('disconnect', () => {
      logger.debug({ userId: socket.user?.id }, 'Socket user disconnected');
      socketRateLimits.delete(socket.id);
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return io;
}

export function emitToUser(userId: string, event: SocketEvent, data: unknown): void {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit(event, data);
  } catch (error) {
    logger.error({ error, userId, event }, 'Socket emit to user error');
  }
}

export function emitToFlat(flatId: string, event: SocketEvent, data: unknown): void {
  if (!io) return;
  try {
    io.to(`flat:${flatId}`).emit(event, data);
  } catch (error) {
    logger.error({ error, flatId, event }, 'Socket emit to flat error');
  }
}

export function emitToSociety(societyId: string, event: SocketEvent, data: unknown): void {
  if (!io) return;
  try {
    io.to(`society:${societyId}`).emit(event, data);
  } catch (error) {
    logger.error({ error, societyId, event }, 'Socket emit to society error');
  }
}

export function emitToUsers(userIds: string[], event: SocketEvent, data: unknown): void {
  if (!io) return;
  try {
    userIds.forEach((userId) => {
      io!.to(`user:${userId}`).emit(event, data);
    });
  } catch (error) {
    logger.error({ error, event, count: userIds.length }, 'Socket emit to users error');
  }
}
