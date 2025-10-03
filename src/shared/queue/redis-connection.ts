import IORedis from 'ioredis'
import { Logger } from '@/shared/utils/logger'
import { Config } from '@/config'

const logger = new Logger('RedisConnection')

/**
 * Create IORedis connection for BullMQ
 *
 * NOTE: This is separate from Fastify Redis (@fastify/redis)
 * BullMQ requires IORedis directly, not the Fastify wrapper
 *
 * @returns IORedis connection
 */
export function createRedisConnection(): IORedis {
  logger.info('Creating Redis connection for BullMQ...')

  let connection: IORedis

  if (Config.REDIS_URL) {
    // Use REDIS_URL if provided (common in production)
    logger.info(`Connecting to Redis via URL: ${Config.REDIS_URL.replace(/:[^:]*@/, ':***@')}`)
    connection = new IORedis(Config.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Required for BullMQ
    })
  } else {
    // Use individual Redis settings
    logger.info(`Connecting to Redis: ${Config.REDIS_HOST}:${Config.REDIS_PORT}`)
    connection = new IORedis({
      host: Config.REDIS_HOST,
      port: Config.REDIS_PORT,
      password: Config.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Required for BullMQ
    })
  }

  // Setup event listeners
  connection.on('connect', () => {
    logger.info('✅ Redis connected for BullMQ')
  })

  connection.on('ready', () => {
    logger.info('✅ Redis ready for BullMQ')
  })

  connection.on('error', (error: Error) => {
    logger.error('❌ Redis connection error', error)
  })

  connection.on('close', () => {
    logger.warn('⚠️  Redis connection closed')
  })

  connection.on('reconnecting', () => {
    logger.info('🔄 Redis reconnecting...')
  })

  return connection
}

/**
 * Close Redis connection
 * @param connection - IORedis connection
 */
export async function closeRedisConnection(connection: IORedis): Promise<void> {
  logger.info('Closing Redis connection...')

  try {
    await connection.quit()
    logger.info('✅ Redis connection closed gracefully')
  } catch (error) {
    logger.error('Error closing Redis connection', error)
    // Force disconnect if graceful close fails
    connection.disconnect()
  }
}
