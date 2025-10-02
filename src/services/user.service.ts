import { Logger } from '@/utils/logger'

interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface GetUsersParams {
  page: number
  limit: number
  search?: string
}

interface UpdateUserDto {
  name?: string
  phone?: string
  role?: string
  isActive?: boolean
}

export class UserService {
  private logger: Logger
  private users: Map<string, User>

  constructor() {
    this.logger = new Logger('UserService')
    this.users = new Map()
    this.initMockData()
  }

  private initMockData(): void {
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        phone: '+1234567890',
        role: 'admin',
        isActive: true,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        email: 'john.doe@example.com',
        name: 'John Doe',
        phone: '+1234567891',
        role: 'user',
        isActive: true,
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        email: 'jane.smith@example.com',
        name: 'Jane Smith',
        role: 'moderator',
        isActive: true,
        createdAt: new Date('2024-02-01').toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    mockUsers.forEach(user => this.users.set(user.id, user))
  }

  async getAllUsers(params: GetUsersParams): Promise<{
    users: User[]
    total: number
    page: number
    limit: number
  }> {
    this.logger.debug(`Fetching users with params: ${JSON.stringify(params)}`)

    let users = Array.from(this.users.values())

    // Apply search filter
    if (params.search) {
      const searchLower = params.search.toLowerCase()
      users = users.filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      )
    }

    // Apply pagination
    const total = users.length
    const start = (params.page - 1) * params.limit
    const paginatedUsers = users.slice(start, start + params.limit)

    return {
      users: paginatedUsers,
      total,
      page: params.page,
      limit: params.limit,
    }
  }

  async getUserById(id: string): Promise<User | null> {
    this.logger.debug(`Fetching user with id: ${id}`)
    return this.users.get(id) || null
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User | null> {
    this.logger.info(`Updating user with id: ${id}`)
    
    const user = this.users.get(id)
    if (!user) {
      return null
    }

    const updatedUser: User = {
      ...user,
      ...dto,
      updatedAt: new Date().toISOString(),
    }

    this.users.set(id, updatedUser)
    return updatedUser
  }

  async deleteUser(id: string): Promise<boolean> {
    this.logger.info(`Deleting user with id: ${id}`)
    return this.users.delete(id)
  }

  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      ...data,
      id: Math.random().toString(36).substring(7),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.users.set(user.id, user)
    this.logger.info(`Created user with id: ${user.id}`)
    return user
  }
}
