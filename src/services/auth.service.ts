import jwt from 'jsonwebtoken'
import { Logger } from '@/utils/logger'
import { AppError } from '@/utils/errors'
import { PasswordUtils } from '@/utils/password'
import { Config } from '@/config'
import { DatabaseService } from '@/services/database.service'
import { RedisService } from '@/services/redis.service'

interface LoginDto {
  email: string
  password: string
}

interface RegisterDto {
  email: string
  password: string
  name: string
  phone?: string
}

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role: 'admin' | 'moderator' | 'user'
  }
}

interface TokenPayload {
  id: string
  email: string
  role: 'admin' | 'moderator' | 'user'
  type: 'access' | 'refresh'
}

// Mock user database (in real app, this would be in database)
const mockUsers = new Map([
  [
    'admin@example.com',
    {
      id: '1',
      email: 'admin@example.com',
      // Password: Admin123!
      password: '$2b$10$YKvNX3uGLM1JrXH5TQVZ3OZKqYqFWXoKcJpPQkqRwKxKfJxGGxXXi',
      name: 'Admin User',
      role: 'admin' as const,
    },
  ],
  [
    'moderator@example.com',
    {
      id: '2',
      email: 'moderator@example.com',
      // Password: Moderator123!
      password: '$2b$10$J5Qv4jXZ1YqKQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ',
      name: 'Moderator User',
      role: 'moderator' as const,
    },
  ],
  [
    'user@example.com',
    {
      id: '3',
      email: 'user@example.com',
      // Password: User123!
      password: '$2b$10$K5Qv4jXZ1YqKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      name: 'Regular User',
      role: 'user' as const,
    },
  ],
])

export class AuthService {
  private logger: Logger
  private redisService: RedisService
  private databaseService: DatabaseService

  constructor() {
    this.logger = new Logger('AuthService')
    this.redisService = new RedisService()
    this.databaseService = new DatabaseService()
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(user: {
    id: string
    email: string
    role: 'admin' | 'moderator' | 'user'
  }) {
    const accessTokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    }

    const refreshTokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: 'refresh',
    }

    const accessToken = jwt.sign(accessTokenPayload, Config.JWT_SECRET, {
      expiresIn: Config.JWT_ACCESS_EXPIRES_IN,
    })

    const refreshToken = jwt.sign(refreshTokenPayload, Config.JWT_SECRET, {
      expiresIn: Config.JWT_REFRESH_EXPIRES_IN,
    })

    return { accessToken, refreshToken }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, Config.JWT_SECRET) as TokenPayload

      if (payload.type !== type) {
        throw new AppError(`Invalid token type. Expected ${type} token`, 401)
      }

      // Check if token is blacklisted in Redis
      const isBlacklisted = await this.redisService.get(`blacklist:${token}`)
      if (isBlacklisted) {
        throw new AppError('Token has been revoked', 401)
      }

      return payload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Token has expired', 401)
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid token', 401)
      }
      throw error
    }
  }

  /**
   * User login
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    this.logger.info(`Login attempt for email: ${dto.email}`)

    // In real app, fetch user from database
    const user = mockUsers.get(dto.email)

    if (!user) {
      throw new AppError('Invalid email or password', 401)
    }

    // For demo purposes, accept these passwords
    const validPasswords: Record<string, string> = {
      'admin@example.com': 'Admin123!',
      'moderator@example.com': 'Moderator123!',
      'user@example.com': 'User123!',
    }

    if (validPasswords[dto.email] !== dto.password) {
      throw new AppError('Invalid email or password', 401)
    }

    const tokens = this.generateTokens(user)

    // Store refresh token in Redis with expiration
    await this.redisService.set(
      `refresh:${user.id}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60 // 7 days in seconds
    )

    this.logger.info(`User ${user.email} logged in successfully`)

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  }

  /**
   * User registration
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    this.logger.info(`Registration attempt for email: ${dto.email}`)

    // Check if user already exists
    if (mockUsers.has(dto.email)) {
      throw new AppError('User with this email already exists', 400)
    }

    // Validate password strength
    const passwordValidation = PasswordUtils.validateStrength(dto.password)
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.errors.join(', '), 400)
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(dto.password)

    // Create new user
    const newUser = {
      id: `user_${Date.now()}`,
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      role: 'user' as const,
    }

    // In real app, save to database
    mockUsers.set(dto.email, newUser)

    const tokens = this.generateTokens(newUser)

    // Store refresh token in Redis
    await this.redisService.set(
      `refresh:${newUser.id}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60 // 7 days
    )

    this.logger.info(`User ${newUser.email} registered successfully`)

    return {
      ...tokens,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.info('Token refresh attempt')

    // Verify refresh token
    const payload = await this.verifyToken(refreshToken, 'refresh')

    // Check if refresh token exists in Redis
    const storedToken = await this.redisService.get(`refresh:${payload.id}`)
    if (storedToken !== refreshToken) {
      throw new AppError('Invalid refresh token', 401)
    }

    // Generate new tokens
    const tokens = this.generateTokens({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    })

    // Update refresh token in Redis
    await this.redisService.set(
      `refresh:${payload.id}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60 // 7 days
    )

    // Blacklist old refresh token
    const decoded = jwt.decode(refreshToken) as any
    const ttl = decoded.exp - Math.floor(Date.now() / 1000)
    if (ttl > 0) {
      await this.redisService.set(`blacklist:${refreshToken}`, '1', ttl)
    }

    this.logger.info(`Tokens refreshed for user ${payload.email}`)

    return tokens
  }

  /**
   * User logout
   */
  async logout(userId: string, accessToken?: string, refreshToken?: string): Promise<void> {
    this.logger.info(`User ${userId} logging out`)

    // Remove refresh token from Redis
    await this.redisService.del(`refresh:${userId}`)

    // Blacklist tokens if provided
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as any
        const ttl = decoded.exp - Math.floor(Date.now() / 1000)
        if (ttl > 0) {
          await this.redisService.set(`blacklist:${accessToken}`, '1', ttl)
        }
      } catch (error) {
        this.logger.warn('Failed to blacklist access token', error)
      }
    }

    if (refreshToken) {
      try {
        const decoded = jwt.decode(refreshToken) as any
        const ttl = decoded.exp - Math.floor(Date.now() / 1000)
        if (ttl > 0) {
          await this.redisService.set(`blacklist:${refreshToken}`, '1', ttl)
        }
      } catch (error) {
        this.logger.warn('Failed to blacklist refresh token', error)
      }
    }

    this.logger.info(`User ${userId} logged out successfully`)
  }

  /**
   * Get user by ID (for authenticated requests)
   */
  async getUserById(userId: string) {
    // In real app, fetch from database
    const user = Array.from(mockUsers.values()).find(u => u.id === userId)

    if (!user) {
      throw new AppError('User not found', 404)
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
  }
}
