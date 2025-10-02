import { createContainer, asValue, asFunction, InjectionMode, Lifetime } from 'awilix'
import { PrismaClient } from '@prisma/client'

// Repositories
import { UserRepository, IUserRepository } from '@/repositories/user.repository'
import { ItemRepository, IItemRepository } from '@/repositories/item.repository'
import { TokenRepository, ITokenRepository } from '@/repositories/token.repository'

// Services
import { AuthService } from '@/services/auth.service'
import { UserService } from '@/services/user.service'
import { ItemService } from '@/services/item.service'

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

/**
 * Create and configure the DI container with proper lifecycle management
 */
export function createDIContainer() {
  const container = createContainer<ICradle>({
    injectionMode: InjectionMode.PROXY,
  })

  // Register Prisma as singleton with proper disposal
  container.register({
    prisma: asFunction(
      () => {
        const client = new PrismaClient({
          log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        })
        return client
      },
      {
        lifetime: Lifetime.SINGLETON,
        dispose: async client => {
          await client.$disconnect()
        },
      }
    ),
  })

  // Register repositories as singletons with explicit dependencies
  container.register({
    userRepository: asFunction(
      ({ prisma }: { prisma: PrismaClient }) => new UserRepository(prisma),
      { lifetime: Lifetime.SINGLETON }
    ),
    itemRepository: asFunction(
      ({ prisma }: { prisma: PrismaClient }) => new ItemRepository(prisma),
      { lifetime: Lifetime.SINGLETON }
    ),
    tokenRepository: asFunction(() => new TokenRepository(), { lifetime: Lifetime.SINGLETON }),
  })

  // Register services as singletons with explicit dependencies
  container.register({
    authService: asFunction(
      ({
        userRepository,
        tokenRepository,
      }: {
        userRepository: IUserRepository
        tokenRepository: ITokenRepository
      }) => new AuthService(userRepository, tokenRepository),
      { lifetime: Lifetime.SINGLETON }
    ),
    userService: asFunction(
      ({ userRepository }: { userRepository: IUserRepository }) => new UserService(userRepository),
      { lifetime: Lifetime.SINGLETON }
    ),
    itemService: asFunction(
      ({ itemRepository }: { itemRepository: IItemRepository }) => new ItemService(itemRepository),
      { lifetime: Lifetime.SINGLETON }
    ),
  })

  return container
}

// Export type for container
export type DIContainer = ReturnType<typeof createDIContainer>
