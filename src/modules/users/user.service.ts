import { Logger } from '@/shared/utils/logger'
import { IUserRepository } from './user.repository'
import { Role, User } from '@prisma/client'
import {
  UserResponseDto,
  UsersPaginationResponse,
  GetUsersQueryDto,
  UpdateUserDto,
} from './user.dto'

export class UserService {
  private logger: Logger

  constructor(private userRepository: IUserRepository) {
    this.logger = new Logger('UserService')
  }

  /**
   * Convert User entity to response DTO with normalized enums
   */
  private toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? undefined, // Convert null to undefined for consistency
      role: user.role.toLowerCase() as 'user' | 'admin' | 'moderator',
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  async getAllUsers(params: GetUsersQueryDto): Promise<UsersPaginationResponse> {
    this.logger.debug(`Fetching users with params: ${JSON.stringify(params)}`)

    const { page, limit } = params

    const { users, total } = await this.userRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      users: users.map(user => this.toResponseDto(user)),
      total,
      page,
      limit,
    }
  }

  async getUserById(id: string): Promise<UserResponseDto | null> {
    this.logger.debug(`Fetching user with id: ${id}`)

    const user = await this.userRepository.findById(id)

    if (!user) {
      return null
    }

    return this.toResponseDto(user)
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto | null> {
    this.logger.info(`Updating user with id: ${id}`)

    try {
      const updatedUser = await this.userRepository.update(id, {
        ...dto,
        role: dto.role ? (dto.role.toUpperCase() as Role) : undefined,
      })

      return this.toResponseDto(updatedUser)
    } catch (error) {
      // Type guard for Prisma errors
      if (error instanceof Error && 'code' in error) {
        const prismaError = error as { code: string }
        if (prismaError.code === 'P2025') {
          return null
        }
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
      if (error instanceof Error && 'code' in error) {
        const prismaError = error as { code: string }
        if (prismaError.code === 'P2025') {
          return false
        }
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
  }): Promise<UserResponseDto> {
    const user = await this.userRepository.create({
      email: data.email,
      password: data.password,
      name: data.name,
      phone: data.phone,
      role: data.role || Role.USER,
    })

    this.logger.info(`Created user with id: ${user.id}`)

    return this.toResponseDto(user)
  }
}
