import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from './Client';

let io: Server | null = null;

/**
 * Socket event name constants to prevent typos and ensure consistency
 */
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

/**
 * Initialize Socket.IO server with authentication
 */
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

      // Verify JWT token
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

      // Get user from database
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

      // Attach user to socket
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
    console.log(`[Socket] User connected: ${socket.user?.id} (${socket.user?.role})`);

    // Join user-specific room
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }

    // Join society room (for society-wide broadcasts)
    if (socket.user?.societyId) {
      socket.join(`society:${socket.user.societyId}`);
    }

    // Join flat room (for flat-specific notifications)
    if (socket.user?.flatId) {
      socket.join(`flat:${socket.user.flatId}`);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.user?.id}`);
    });

    // Optional: Handle custom events
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  });

  console.log('[Socket] Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return io;
}

/**
 * Emit to a specific user
 */
export function emitToUser(userId: string, event: SocketEvent, data: unknown): void {
  if (!io) {
    console.warn(`[Socket] Cannot emit '${event}' to user:${userId} - Socket.IO not initialized`);
    return;
  }
  try {
    io.to(`user:${userId}`).emit(event, data);
  } catch (error) {
    console.error(`[Socket] Error emitting '${event}' to user:${userId}:`, error);
  }
}

/**
 * Emit to all users in a flat
 */
export function emitToFlat(flatId: string, event: SocketEvent, data: unknown): void {
  if (!io) {
    console.warn(`[Socket] Cannot emit '${event}' to flat:${flatId} - Socket.IO not initialized`);
    return;
  }
  try {
    io.to(`flat:${flatId}`).emit(event, data);
  } catch (error) {
    console.error(`[Socket] Error emitting '${event}' to flat:${flatId}:`, error);
  }
}

/**
 * Emit to all users in a society
 */
export function emitToSociety(societyId: string, event: SocketEvent, data: unknown): void {
  if (!io) {
    console.warn(`[Socket] Cannot emit '${event}' to society:${societyId} - Socket.IO not initialized`);
    return;
  }
  try {
    io.to(`society:${societyId}`).emit(event, data);
  } catch (error) {
    console.error(`[Socket] Error emitting '${event}' to society:${societyId}:`, error);
  }
}

/**
 * Emit to multiple users
 */
export function emitToUsers(userIds: string[], event: SocketEvent, data: unknown): void {
  if (!io) {
    console.warn(`[Socket] Cannot emit '${event}' to ${userIds.length} users - Socket.IO not initialized`);
    return;
  }
  try {
    userIds.forEach((userId) => {
      io!.to(`user:${userId}`).emit(event, data);
    });
  } catch (error) {
    console.error(`[Socket] Error emitting '${event}' to multiple users:`, error);
  }
}
