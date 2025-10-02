import jwt from 'jsonwebtoken'
import { Logger } from '@/utils/logger'
import { AppError } from '@/utils/errors'
import { PasswordUtils } from '@/utils/password'
import { Config } from '@/config'
import { RedisService } from '@/services/redis.service'
import prisma from '@/services/prisma.service'
import { Role } from '@prisma/client'

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

export class AuthService {
  private logger: Logger
  private redisService: RedisService

  constructor() {
    this.logger = new Logger('AuthService')
    this.redisService = new RedisService()
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
      expiresIn: Config.JWT_ACCESS_EXPIRES_IN || '15m',
    })

    const refreshToken = jwt.sign(refreshTokenPayload, Config.JWT_SECRET, {
      expiresIn: Config.JWT_REFRESH_EXPIRES_IN || '7d',
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
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token has expired', 401)
      }
      if (error.name === 'JsonWebTokenError') {
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

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    })

    if (!user) {
      throw new AppError('Invalid email or password', 400)
    }

    // Verify password
    const isPasswordValid = await PasswordUtils.compare(dto.password, user.password)

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 400)
    }

    const tokens = this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase() as 'admin' | 'moderator' | 'user',
    })

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
        role: user.role.toLowerCase() as 'admin' | 'moderator' | 'user',
      },
    }
  }

  /**
   * User registration
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    this.logger.info(`Registration attempt for email: ${dto.email}`)

    // Validate password strength
    const passwordValidation = PasswordUtils.validateStrength(dto.password)
    if (!passwordValidation.valid) {
      throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400)
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    })

    if (existingUser) {
      throw new AppError('User with this email already exists', 400)
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(dto.password)

    // Create new user in database
    const newUser = await prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
        role: Role.USER,
      },
    })

    const tokens = this.generateTokens({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role.toLowerCase() as 'admin' | 'moderator' | 'user',
    })

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
        role: newUser.role.toLowerCase() as 'admin' | 'moderator' | 'user',
      },
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    this.logger.info('Token refresh attempt')

    // Verify refresh token
    const payload = await this.verifyToken(refreshToken, 'refresh')

    // Check if refresh token is stored in Redis
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
    await this.redisService.set(`refresh:${payload.id}`, tokens.refreshToken, 7 * 24 * 60 * 60)

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
      const decoded = jwt.decode(accessToken) as any
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)
      if (expiresIn > 0) {
        await this.redisService.set(`blacklist:${accessToken}`, '1', expiresIn)
      }
    }

    if (refreshToken) {
      const decoded = jwt.decode(refreshToken) as any
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)
      if (expiresIn > 0) {
        await this.redisService.set(`blacklist:${refreshToken}`, '1', expiresIn)
      }
    }

    this.logger.info(`User ${userId} logged out successfully`)
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<{
    id: string
    email: string
    name: string
    role: 'admin' | 'moderator' | 'user'
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    if (!user) {
      throw new AppError('User not found', 404)
    }

    return {
      ...user,
      role: user.role.toLowerCase() as 'admin' | 'moderator' | 'user',
    }
  }
}
