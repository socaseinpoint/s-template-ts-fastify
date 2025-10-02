import { Logger } from '@/utils/logger'
import prisma from '@/services/prisma.service'
import { AppError } from '@/utils/errors'
import { Role } from '@prisma/client'

interface GetUsersParams {
  page: number
  limit: number
  search?: string
}

interface UpdateUserDto {
  name?: string
  phone?: string
  role?: Role
  isActive?: boolean
}

export class UserService {
  private logger: Logger

  constructor() {
    this.logger = new Logger('UserService')
  }

  async getAllUsers(params: GetUsersParams): Promise<{
    users: any[]
    total: number
    page: number
    limit: number
  }> {
    this.logger.debug(`Fetching users with params: ${JSON.stringify(params)}`)

    const { page, limit, search } = params

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Get total count
    const total = await prisma.user.count({ where })

    // Get paginated users
    const users = await prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
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

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

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
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...dto,
          role: dto.role ? (dto.role.toUpperCase() as Role) : undefined,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        ...updatedUser,
        role: updatedUser.role.toLowerCase(),
      }
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    this.logger.info(`Deleting user with id: ${id}`)

    try {
      await prisma.user.delete({
        where: { id },
      })
      return true
    } catch (error: any) {
      if (error.code === 'P2025') {
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
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone,
        role: data.role || Role.USER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    this.logger.info(`Created user with id: ${user.id}`)

    return {
      ...user,
      role: user.role.toLowerCase(),
    }
  }
}
