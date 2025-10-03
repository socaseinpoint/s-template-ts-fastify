import { createContainer, asValue, asClass, InjectionMode, Lifetime, AwilixContainer } from 'awilix'
import { PrismaClient } from '@prisma/client'
import { Logger } from '@/shared/utils/logger'
import type { FastifyRedis } from '@fastify/redis'
import type IORedis from 'ioredis'
import type { Queue } from 'bullmq'

// Modules
import { AuthService } from '@/modules/auth'
import { UserService, UserRepository, type IUserRepository } from '@/modules/users'
import { ItemService, ItemRepository, type IItemRepository } from '@/modules/items'
import { RedisTokenRepository, type ITokenRepository } from '@/shared/cache/redis-token.repository'
import { InMemoryTokenRepository } from '@/shared/cache/in-memory-token.repository'

// Queue services
import { QueueService } from '@/shared/queue/queue.service'
import { WorkerService } from '@/shared/queue/worker.service'
import { QUEUE_NAMES, type WebhookJobData } from '@/jobs'

const logger = new Logger('Container')

export interface ICradle {
  // Infrastructure
  prisma: PrismaClient
  redis?: FastifyRedis // Optional (fallback to in-memory in development)
  metrics?: {
    queueJobsProcessed: unknown
    queueJobDuration: unknown
  }

  // Repositories
  userRepository: IUserRepository
  itemRepository: IItemRepository
  tokenRepository: ITokenRepository

  // Services
  authService: AuthService
  userService: UserService
  itemService: ItemService

  // Queue infrastructure (optional - only when MODE=all)
  redisConnection?: IORedis
  queueService?: QueueService
  workerService?: WorkerService

  // Queues (optional - only when MODE=all)
  webhookQueue?: Queue<WebhookJobData>
}

export interface ContainerOptions {
  prisma?: PrismaClient
  redis?: FastifyRedis // Optional (fallback to in-memory in development)
  skipConnect?: boolean
  enableQueues?: boolean // Enable queue services (for MODE=all)
  redisConnection?: IORedis // IORedis connection for BullMQ (separate from Fastify Redis)
}

/**
 * Create and configure the DI container
 * SCOPED lifetime for stateless request handling
 */
export async function createDIContainer(
  options: ContainerOptions
): Promise<AwilixContainer<ICradle>> {
  const container = createContainer<ICradle>({
    injectionMode: InjectionMode.CLASSIC,
  })

  // Initialize Prisma client
  let prismaClient: PrismaClient

  if (options.prisma) {
    // Use provided Prisma client (for testing)
    prismaClient = options.prisma
    logger.info('Using provided Prisma client')
  } else {
    // Validate DATABASE_URL
    const { validateDatabaseConfig } = await import('@/shared/utils/env-validation')
    validateDatabaseConfig(process.env.DATABASE_URL, process.env.NODE_ENV)

    if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'test') {
      // Unit test mode - use mock
      const { mockDeep } = await import('vitest-mock-extended')
      prismaClient = mockDeep<PrismaClient>()
      logger.warn('⚠️  Unit test mode: using mocked Prisma client')
    } else {
      // Create new Prisma client and connect
      logger.info('Initializing Prisma client...')

      prismaClient = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      })

      if (!options.skipConnect) {
        try {
          await prismaClient.$connect()
          logger.info('✅ Prisma client connected to database')
        } catch (error) {
          logger.error('❌ Failed to connect to database', error)
          throw new Error(`Database connection failed: ${error}`)
        }
      }
    }
  }

  // Register Prisma
  container.register({
    prisma: asValue(prismaClient),
  })

  // Register Redis (required)
  container.register({
    redis: asValue(options.redis),
  })
  logger.info('✅ Redis registered for distributed token storage')

  // Register repositories with SINGLETON lifetime
  // Since repositories are stateless and only depend on Prisma/Redis,
  // SINGLETON is safe and more efficient than SCOPED
  container.register({
    userRepository: asClass(UserRepository, { lifetime: Lifetime.SINGLETON }),
    itemRepository: asClass(ItemRepository, { lifetime: Lifetime.SINGLETON }),
  })

  // Register token repository (Redis or in-memory fallback)
  const { validateRedisConfig: validateRedisForTokens } = await import(
    '@/shared/utils/env-validation'
  )

  // Validate Redis for token storage
  validateRedisForTokens({
    redisUrl: process.env.REDIS_URL,
    redisHost: process.env.REDIS_HOST,
    nodeEnv: process.env.NODE_ENV || 'development',
    context: 'token storage',
  })

  if (options.redis) {
    container.register({
      tokenRepository: asClass(RedisTokenRepository, { lifetime: Lifetime.SINGLETON }),
    })
    logger.info('✅ Token storage: Redis (distributed)')
  } else {
    container.register({
      tokenRepository: asClass(InMemoryTokenRepository, { lifetime: Lifetime.SINGLETON }),
    })
    logger.warn('⚠️  Token storage: In-Memory (development only)')
  }

  // Register business services with SINGLETON lifetime
  // Services are stateless - all state is passed through method parameters
  container.register({
    authService: asClass(AuthService, { lifetime: Lifetime.SINGLETON }),
    userService: asClass(UserService, { lifetime: Lifetime.SINGLETON }),
    itemService: asClass(ItemService, { lifetime: Lifetime.SINGLETON }),
  })

  // Register queue services (optional - only if enableQueues is true)
  if (options.enableQueues && options.redisConnection) {
    logger.info('Registering queue services...')

    // Register Redis connection for BullMQ
    container.register({
      redisConnection: asValue(options.redisConnection),
    })

    // Register queue and worker services
    container.register({
      queueService: asClass(QueueService, { lifetime: Lifetime.SINGLETON }),
      workerService: asClass(WorkerService, { lifetime: Lifetime.SINGLETON }),
    })

    // Create queues
    const queueService = container.cradle.queueService
    if (!queueService) {
      throw new Error('QueueService not initialized')
    }
    const webhookQueue = queueService.createQueue<WebhookJobData>(QUEUE_NAMES.WEBHOOK)

    // Register queues in container
    container.register({
      webhookQueue: asValue(webhookQueue),
    })

    logger.info('✅ Queue services registered')
  }

  logger.info('✅ DI Container initialized (Token storage: Redis)')

  return container
}

/**
 * Dispose DI container and cleanup resources
 * IMPORTANT: Call this before shutting down the application
 */
export async function disposeDIContainer(container: AwilixContainer<ICradle>): Promise<void> {
  logger.info('Disposing DI container...')

  try {
    // Close queue services (if enabled)
    const queueService = container.cradle.queueService
    if (queueService) {
      logger.info('Closing queue service...')
      await queueService.close()
      logger.info('✅ Queue service closed')
    }

    const workerService = container.cradle.workerService
    if (workerService) {
      logger.info('Closing worker service...')
      await workerService.close()
      logger.info('✅ Worker service closed')
    }

    // Close Redis connection for BullMQ
    const redisConnection = container.cradle.redisConnection
    if (redisConnection) {
      logger.info('Closing BullMQ Redis connection...')
      await redisConnection.quit()
      logger.info('✅ BullMQ Redis connection closed')
    }

    // Cleanup TokenRepository interval (prevents memory leak)
    const tokenRepository = container.cradle.tokenRepository
    if (tokenRepository && typeof tokenRepository.dispose === 'function') {
      tokenRepository.dispose()
      logger.info('✅ Token repository disposed')
    }

    // Disconnect Prisma client
    const prisma = container.cradle.prisma
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect()
      logger.info('✅ Prisma client disconnected')
    }
  } catch (error) {
    logger.error('Error disconnecting resources', error)
  }

  // Dispose container
  await container.dispose()
  logger.info('✅ DI container disposed')
}

// Export type for container
export type DIContainer = AwilixContainer<ICradle>
