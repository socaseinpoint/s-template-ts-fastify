import { PrismaClient, User, Role } from '@prisma/client'
import { Logger } from '@/utils/logger'

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

export class UserRepository implements IUserRepository {
  private logger: Logger

  constructor(private prisma: PrismaClient) {
    this.logger = new Logger('UserRepository')
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

  async findById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
      })
    } catch (error) {
      this.logger.error(`Error finding user by id: ${id}`, error)
      throw error
    }
  }

  async create(data: CreateUserDto): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          password: data.password,
          name: data.name,
          phone: data.phone,
          role: data.role || Role.USER,
        },
      })
    } catch (error) {
      this.logger.error(`Error creating user: ${data.email}`, error)
      throw error
    }
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      })
    } catch (error) {
      this.logger.error(`Error updating user: ${id}`, error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      })
    } catch (error) {
      this.logger.error(`Error deleting user: ${id}`, error)
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
