import { createContainer, asValue, asClass, InjectionMode, Lifetime, AwilixContainer } from 'awilix'
import { PrismaClient } from '@prisma/client'
import { Logger } from '@/shared/utils/logger'
import type { FastifyRedis } from '@fastify/redis'

// Modules
import { AuthService } from '@/modules/auth'
import { UserService, UserRepository, type IUserRepository } from '@/modules/users'
import { ItemService, ItemRepository, type IItemRepository } from '@/modules/items'
import { TokenRepository, type ITokenRepository } from '@/shared/cache/token.repository'
import { RedisTokenRepository } from '@/shared/cache/redis-token.repository'

const logger = new Logger('Container')

export interface ICradle {
  // Infrastructure
  prisma: PrismaClient
  redis?: FastifyRedis

  // Repositories
  userRepository: IUserRepository
  itemRepository: IItemRepository
  tokenRepository: ITokenRepository

  // Services
  authService: AuthService
  userService: UserService
  itemService: ItemService
}

export interface ContainerOptions {
  prisma?: PrismaClient
  redis?: FastifyRedis
  skipConnect?: boolean
}

/**
 * Create and configure the DI container
 * SCOPED lifetime for stateless request handling
 */
export async function createDIContainer(
  options: ContainerOptions = {}
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
  } else if (!process.env.DATABASE_URL) {
    // No DATABASE_URL - mock for unit tests
    if (process.env.NODE_ENV === 'test') {
      logger.warn('⚠️  Unit test mode: using mock Prisma client')
      prismaClient = {} as PrismaClient
    } else {
      throw new Error('DATABASE_URL is required in non-test environments')
    }
  } else {
    // Create new Prisma client and connect
    logger.info('Initializing Prisma client...')

    // Configure connection pooling based on environment
    const connectionLimit = process.env.NODE_ENV === 'production' ? 20 : 10

    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      // Connection pooling configuration
      // Note: These are passed to the underlying database driver
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })

    if (!options.skipConnect) {
      try {
        await prismaClient.$connect()
        logger.info(`✅ Prisma client connected to database (pool size: ${connectionLimit})`)
      } catch (error) {
        logger.error('❌ Failed to connect to database', error)
        throw new Error(`Database connection failed: ${error}`)
      }
    }
  }

  // Register Prisma
  container.register({
    prisma: asValue(prismaClient),
  })

  // Register Redis if available
  if (options.redis) {
    container.register({
      redis: asValue(options.redis),
    })
    logger.info('✅ Redis available for distributed token storage')
  }

  // Register repositories with SINGLETON lifetime
  // Since repositories are stateless and only depend on Prisma/Redis,
  // SINGLETON is safe and more efficient than SCOPED
  container.register({
    userRepository: asClass(UserRepository, { lifetime: Lifetime.SINGLETON }),
    itemRepository: asClass(ItemRepository, { lifetime: Lifetime.SINGLETON }),
    // Choose TokenRepository implementation based on Redis availability
    tokenRepository: options.redis
      ? asClass(RedisTokenRepository, { lifetime: Lifetime.SINGLETON })
      : asClass(TokenRepository, { lifetime: Lifetime.SINGLETON }),
  })

  // Register business services with SINGLETON lifetime
  // Services are stateless - all state is passed through method parameters
  container.register({
    authService: asClass(AuthService, { lifetime: Lifetime.SINGLETON }),
    userService: asClass(UserService, { lifetime: Lifetime.SINGLETON }),
    itemService: asClass(ItemService, { lifetime: Lifetime.SINGLETON }),
  })

  logger.info(
    `✅ DI Container initialized (Token storage: ${options.redis ? 'Redis' : 'In-Memory'})`
  )

  return container
}

/**
 * Dispose DI container and cleanup resources
 * IMPORTANT: Call this before shutting down the application
 */
export async function disposeDIContainer(container: AwilixContainer<ICradle>): Promise<void> {
  logger.info('Disposing DI container...')

  try {
    const prisma = container.cradle.prisma
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect()
      logger.info('✅ Prisma client disconnected')
    }
  } catch (error) {
    logger.error('Error disconnecting Prisma', error)
  }

  // Dispose container
  await container.dispose()
  logger.info('✅ DI container disposed')
}

// Export type for container
export type DIContainer = AwilixContainer<ICradle>
