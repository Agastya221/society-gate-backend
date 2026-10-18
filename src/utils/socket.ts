import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { isTokenBlacklisted, verifyAccessTokenForUser } from '../services/token.service';
import { verifyStaffToken } from '../modules/staff-app/staff-app.token';
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
  /** Set instead of `user` when the staff app (domestic staff / vendors) is connected */
  staff?: {
    accountId: string;
    domesticStaffId: string;
    societyId: string;
  };
}

// ── Alert delivery: in-app first, push as the fallback ───────────────────────────────────────
// Each app connects and tells us when it is open on screen ('app-state' = 'active'). An alert goes
// to the screen only when the app confirms it actually showed it; everything else is pushed.
export type AlertTarget = 'user' | 'staff';
export const IN_APP_ALERT_EVENT = 'alert';
const ALERT_ACK_TIMEOUT_MS = 2500;

export interface InAppAlert {
  title: string;
  body: string;
  data: Record<string, string>;
  urgent: boolean;
}

// `${kind}:${id}` -> ids of that person's sockets whose app is open on screen right now
const foregroundSockets = new Map<string, Set<string>>();

const identityOf = (socket: AuthenticatedSocket): string | null =>
  socket.user ? `user:${socket.user.id}` : socket.staff ? `staff:${socket.staff.accountId}` : null;

function markForeground(socket: AuthenticatedSocket, active: boolean): void {
  const key = identityOf(socket);
  if (!key) return;
  const sockets = foregroundSockets.get(key) ?? new Set<string>();
  if (active) sockets.add(socket.id);
  else sockets.delete(socket.id);
  if (sockets.size > 0) foregroundSockets.set(key, sockets);
  else foregroundSockets.delete(key);
}

/** True when the person's app is open on screen and confirmed it showed the alert. */
export async function deliverInApp(kind: AlertTarget, id: string, alert: InAppAlert): Promise<boolean> {
  if (!io) return false;
  const open = foregroundSockets.get(`${kind}:${id}`);
  if (!open || open.size === 0) return false;
  const room = kind === 'user' ? `user:${id}` : `staffacct:${id}`;
  try {
    const acks = await io.in(room).timeout(ALERT_ACK_TIMEOUT_MS).emitWithAck(IN_APP_ALERT_EVENT, alert);
    return acks.some((ack: { shown?: boolean } | undefined) => ack?.shown === true);
  } catch (error) {
    // Some of the person's sockets did not answer in time; answers that did arrive are on the error
    const answered: Array<{ shown?: boolean } | undefined> = (error as { responses?: [] })?.responses ?? [];
    return answered.some((ack) => ack?.shown === true);
  }
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
  // Same allow-list as the HTTP CORS policy (CLIENT_URL / ALLOWED_ORIGINS).
  // Native apps send no Origin and are unaffected by CORS. Without an allow-list,
  // no browser origin is allowed — never '*' together with credentials.
  const allowedOrigins = [process.env.CLIENT_URL, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((url) => url.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      methods: ['GET', 'POST'],
      credentials: allowedOrigins.length > 0,
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication required'));
      }

      try {
        // Same checks as the HTTP auth middleware: HS256 + user audience,
        // type === 'access' (refresh/QR/staff tokens rejected), blacklist
        // (logged-out tokens), user exists and is active, appType matches role.
        const { user } = await verifyAccessTokenForUser(token);

        socket.user = {
          id: user.id,
          role: user.role,
          societyId: user.societyId || undefined,
          flatId: user.flatId || undefined,
        };
        return next();
      } catch {
        // Not a resident/admin/guard token: it may be a staff-app token (own audience)
      }

      const decoded = verifyStaffToken(token, 'access');
      if (await isTokenBlacklisted(decoded.jti)) throw new Error('revoked');
      const account = await prisma.staffAccount.findUnique({
        where: { id: decoded.staffAccountId },
        select: { id: true, isActive: true, domesticStaffId: true, domesticStaff: { select: { isActive: true, societyId: true } } },
      });
      if (!account || !account.isActive || !account.domesticStaff.isActive
        || account.domesticStaffId !== decoded.domesticStaffId) {
        throw new Error('inactive');
      }
      socket.staff = {
        accountId: account.id,
        domesticStaffId: account.domesticStaffId,
        societyId: account.domesticStaff.societyId,
      };

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({ userId: socket.user?.id ?? socket.staff?.accountId, role: socket.user?.role ?? 'STAFF' }, 'Socket user connected');

    if (socket.staff) {
      socket.join(`staffacct:${socket.staff.accountId}`);
    }

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

    // The app says whether it is open on screen; only then do alerts go in-app instead of push
    socket.on('app-state', (state: unknown) => markForeground(socket, state === 'active'));

    socket.on('disconnect', () => {
      logger.debug({ userId: socket.user?.id }, 'Socket user disconnected');
      markForeground(socket, false);
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
