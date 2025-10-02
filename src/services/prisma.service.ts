import { PrismaClient } from '@prisma/client'
import { Logger } from '@/utils/logger'

const logger = new Logger('PrismaService')

/**
 * Singleton Prisma Client instance
 * Prevents multiple instances in development (hot reload)
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect()
    logger.info('✅ Prisma connected to database')
  } catch (error) {
    logger.error('❌ Failed to connect to database', error)
    throw error
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect()
    logger.info('Database disconnected')
  } catch (error) {
    logger.error('Error disconnecting from database', error)
  }
}

export default prisma
