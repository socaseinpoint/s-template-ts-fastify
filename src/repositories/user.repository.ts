import { PrismaClient, User, Role } from '@prisma/client'
import { BaseRepository } from './base.repository'

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  create(data: CreateUserDto): Promise<User>
  update(id: string, data: UpdateUserDto): Promise<User>
  delete(id: string): Promise<void>
  findMany(params: FindManyUsersParams): Promise<{ users: User[]; total: number }>
}

export interface CreateUserDto {
  email: string
  password: string
  name: string
  phone?: string
  role?: Role
}

export interface UpdateUserDto {
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
  extends BaseRepository<User, CreateUserDto, UpdateUserDto>
  implements IUserRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'User')
  }

  protected getModel() {
    return this.prisma.user
  }

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
}
