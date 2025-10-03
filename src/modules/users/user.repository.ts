import { PrismaClient, User, Role } from '@prisma/client'
import { BaseRepository } from '@/shared/database/base.repository'

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(data: CreateUserData): Promise<User>
  update(id: string, data: UpdateUserData): Promise<User>
  delete(id: string): Promise<void>
  findMany(params: FindManyUsersParams): Promise<{ users: User[]; total: number }>
}

/**
 * Data transfer objects for repository layer
 * Note: These are different from HTTP DTOs (user.dto.ts)
 * These include internal fields like password, Prisma enums, etc.
 */
export interface CreateUserData {
  email: string
  password: string
  name: string
  phone?: string
  role?: Role
}

export interface UpdateUserData {
  email?: string
  password?: string
  name?: string
  phone?: string
  role?: Role
  isActive?: boolean
}

export interface FindManyUsersParams {
  skip?: number
  take?: number
  where?: {
    email?: string
    role?: Role
    isActive?: boolean
  }
}

export class UserRepository
  extends BaseRepository<User, CreateUserData, UpdateUserData>
  implements IUserRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'User')
  }

  protected getModel() {
    return this.prisma.user
  }

  /**
   * Find user by email - custom method not in BaseRepository
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
      })
    } catch (error) {
      this.logger.error(`Error finding user by email: ${email}`, error)
      throw error
    }
  }

  /**
   * Find many users with custom pagination response
   * Override BaseRepository to return custom structure
   */
  // @ts-expect-error - Override with custom pagination response
  async findMany(params: FindManyUsersParams): Promise<{ users: User[]; total: number }> {
    try {
      const { skip = 0, take = 10, where = {} } = params

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ])

      return { users, total }
    } catch (error) {
      this.logger.error('Error finding many users', error)
      throw error
    }
  }

  // Note: findById, create, update, delete are inherited from BaseRepository
  // No need to override them unless adding custom logic
}
