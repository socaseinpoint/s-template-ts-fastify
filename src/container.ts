import { createContainer, asValue, asClass, InjectionMode, Lifetime, AwilixContainer } from 'awilix'
import { PrismaClient } from '@prisma/client'
import { Logger } from '@/utils/logger'

// Repositories
import { UserRepository, IUserRepository } from '@/repositories/user.repository'
import { ItemRepository, IItemRepository } from '@/repositories/item.repository'
import { TokenRepository, ITokenRepository } from '@/repositories/token.repository'

// Services
import { AuthService } from '@/services/auth.service'
import { UserService } from '@/services/user.service'
import { ItemService } from '@/services/item.service'

const logger = new Logger('Container')

export interface ICradle {
  // Infrastructure
  prisma: PrismaClient

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
  skipConnect?: boolean
}

/**
 * Create and configure the DI container
 * Simplified version without over-engineering
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

  // Register repositories
  container.register({
    userRepository: asClass(UserRepository, { lifetime: Lifetime.SINGLETON }),
    itemRepository: asClass(ItemRepository, { lifetime: Lifetime.SINGLETON }),
    tokenRepository: asClass(TokenRepository, { lifetime: Lifetime.SINGLETON }),
  })

  // Register business services
  container.register({
    authService: asClass(AuthService, { lifetime: Lifetime.SINGLETON }),
    userService: asClass(UserService, { lifetime: Lifetime.SINGLETON }),
    itemService: asClass(ItemService, { lifetime: Lifetime.SINGLETON }),
  })

  logger.info('✅ DI Container initialized')

  return container
}

// Export type for container
export type DIContainer = AwilixContainer<ICradle>
