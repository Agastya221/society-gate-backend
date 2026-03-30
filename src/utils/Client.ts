import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Prisma } from '../../prisma/generated/prisma/client'
import logger from './logger';

const connectionString = `${process.env.DATABASE_URL}`

// IMP-3: Configure connection pool size
const adapter = new PrismaPg({
  connectionString,
  max: parseInt(process.env.DB_POOL_SIZE || '5', 10),
  idleTimeoutMillis: 30000,        // Close idle connections after 30s (before Render/NAT kills them)
  connectionTimeoutMillis: 10000,  // Fail fast if can't get a connection in 10s
  keepAlive: true,                 // Send TCP keep-alive packets to prevent silent drops
})
const prisma = new PrismaClient({ adapter })

// Export types
export type TransactionClient = Prisma.TransactionClient;
export { prisma };

// Connection helpers
export const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.fatal({ error }, 'Database connection failed');
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  await prisma.$disconnect();
};