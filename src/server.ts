import dotenv from 'dotenv';
import { createServer } from 'http';
import app from './app';
import { initializeSocketIO } from './utils/socket';
import { prisma } from './utils/Client';
import { redis } from './config/redis';
import logger from './utils/logger';
import './jobs/expiry.job';
import './listeners/notification.listener';

dotenv.config();

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

initializeSocketIO(httpServer);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server started');
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully');

  httpServer.close(async () => {
    logger.info('HTTP server closed');

    await prisma.$disconnect().catch((err) => {
      logger.error({ error: err }, 'Error disconnecting Prisma');
    });
    logger.info('Database disconnected');

    await redis.quit().catch((err) => {
      logger.error({ error: err }, 'Error disconnecting Redis');
    });
    logger.info('Redis disconnected');

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
