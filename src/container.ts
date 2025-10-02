import { createContainer, asValue, asClass, InjectionMode, Lifetime, AwilixContainer } from 'awilix'
import { PrismaClient } from '@prisma/client'
import { Logger } from '@/utils/logger'
import type { FastifyRedis } from '@fastify/redis'

// Repositories
import { UserRepository, IUserRepository } from '@/repositories/user.repository'
import { ItemRepository, IItemRepository } from '@/repositories/item.repository'
import { TokenRepository, ITokenRepository } from '@/repositories/token.repository'
import { RedisTokenRepository } from '@/repositories/redis-token.repository'

// Services
import { AuthService } from '@/services/auth.service'
import { UserService } from '@/services/user.service'
import { ItemService } from '@/services/item.service'

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
    prismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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

  // Register repositories with SCOPED lifetime for clean request isolation
  container.register({
    userRepository: asClass(UserRepository, { lifetime: Lifetime.SCOPED }),
    itemRepository: asClass(ItemRepository, { lifetime: Lifetime.SCOPED }),
    // Choose TokenRepository implementation based on Redis availability
    tokenRepository: options.redis
      ? asClass(RedisTokenRepository, { lifetime: Lifetime.SCOPED })
      : asClass(TokenRepository, { lifetime: Lifetime.SCOPED }),
  })

  // Register business services with SCOPED lifetime
  container.register({
    authService: asClass(AuthService, { lifetime: Lifetime.SCOPED }),
    userService: asClass(UserService, { lifetime: Lifetime.SCOPED }),
    itemService: asClass(ItemService, { lifetime: Lifetime.SCOPED }),
  })

  logger.info(
    `✅ DI Container initialized (Token storage: ${options.redis ? 'Redis' : 'In-Memory'})`
  )

  return container
}

// Export type for container
export type DIContainer = AwilixContainer<ICradle>
