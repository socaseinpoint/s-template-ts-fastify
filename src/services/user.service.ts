import { Logger } from '@/utils/logger'
import { IUserRepository } from '@/repositories/user.repository'
import { Role } from '@prisma/client'

interface GetUsersParams {
  page: number
  limit: number
  search?: string
}

interface UpdateUserDto {
  name?: string
  phone?: string
  role?: string // Accepts lowercase, converts to uppercase internally
  isActive?: boolean
}

export class UserService {
  private logger: Logger

  constructor(private userRepository: IUserRepository) {
    this.logger = new Logger('UserService')
  }

  async getAllUsers(params: GetUsersParams): Promise<{
    users: any[]
    total: number
    page: number
    limit: number
  }> {
    this.logger.debug(`Fetching users with params: ${JSON.stringify(params)}`)

    const { page, limit } = params

    const { users, total } = await this.userRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      users: users.map(user => ({
        ...user,
        role: user.role.toLowerCase(),
      })),
      total,
      page,
      limit,
    }
  }

  async getUserById(id: string): Promise<any | null> {
    this.logger.debug(`Fetching user with id: ${id}`)

    const user = await this.userRepository.findById(id)

    if (!user) {
      return null
    }

    return {
      ...user,
      role: user.role.toLowerCase(),
    }
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<any | null> {
    this.logger.info(`Updating user with id: ${id}`)

    try {
      const updatedUser = await this.userRepository.update(id, {
        ...dto,
        role: dto.role ? (dto.role.toUpperCase() as Role) : undefined,
      })

      return {
        ...updatedUser,
        role: updatedUser.role.toLowerCase(),
      }
    } catch (error) {
      // Type guard for Prisma errors
      if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    this.logger.info(`Deleting user with id: ${id}`)

    try {
      await this.userRepository.delete(id)
      return true
    } catch (error) {
      // Type guard for Prisma errors
      if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
        return false
      }
      throw error
    }
  }

  async createUser(data: {
    email: string
    password: string
    name: string
    phone?: string
    role?: Role
  }): Promise<any> {
    const user = await this.userRepository.create({
      email: data.email,
      password: data.password,
      name: data.name,
      phone: data.phone,
      role: data.role || Role.USER,
    })

    this.logger.info(`Created user with id: ${user.id}`)

    return {
      ...user,
      role: user.role.toLowerCase(),
    }
  }
}
