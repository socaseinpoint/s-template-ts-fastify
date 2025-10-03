import jwt from 'jsonwebtoken'
import { Logger } from '@/shared/utils/logger'
import { AuditLogger } from '@/shared/utils/audit-logger'
import { UnauthorizedError, ValidationError, AlreadyExistsError } from '@/shared/utils/errors'
import { PasswordUtils } from '@/shared/utils/password'
import { Config } from '@/config'
import { IUserRepository, type CreateUserData } from '@/modules/users/user.repository'
import { ITokenRepository } from '@/shared/cache/redis-token.repository'
import { Role } from '@prisma/client'
import { UserRole, TOKEN_TYPES } from '@/constants'
import { TokenPayload } from '@/shared/types'
import { LoginDto, RegisterDto, AuthResponse } from './auth.dto'

/**
 * Authentication Service
 * SINGLE RESPONSIBILITY: Only handles authentication logic
 * User management is in UserService
 */
export class AuthService {
  private logger: Logger

  constructor(
    private userRepository: IUserRepository,
    private tokenRepository: ITokenRepository
  ) {
    this.logger = new Logger('AuthService')
  }

  /**
   * Convert Prisma Role to UserRole
   */
  private convertRole(role: Role): UserRole {
    const roleMap: Record<Role, UserRole> = {
      [Role.ADMIN]: UserRole.ADMIN,
      [Role.MODERATOR]: UserRole.MODERATOR,
      [Role.USER]: UserRole.USER,
    }
    return roleMap[role] || UserRole.USER
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(user: { id: string; email: string; role: UserRole }) {
    const accessTokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: TOKEN_TYPES.ACCESS,
    }

    const refreshTokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: TOKEN_TYPES.REFRESH,
    }

    const accessToken = jwt.sign(accessTokenPayload, Config.JWT_SECRET, {
      expiresIn: Config.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions)

    const refreshToken = jwt.sign(refreshTokenPayload, Config.JWT_SECRET, {
      expiresIn: Config.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions)

    return { accessToken, refreshToken }
  }

  /**
   * Parse JWT expiration time to seconds
   * Supports common time formats: 15m, 1h, 7d, etc.
   */
  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/)
    if (!match) return 7 * 24 * 60 * 60 // Default 7 days

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 's':
        return value
      case 'm':
        return value * 60
      case 'h':
        return value * 60 * 60
      case 'd':
        return value * 24 * 60 * 60
      default:
        return 7 * 24 * 60 * 60
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, Config.JWT_SECRET) as TokenPayload

      if (payload.type !== type) {
        throw new UnauthorizedError(`Invalid token type. Expected ${type} token`)
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenRepository.get(`blacklist:${token}`)
      if (isBlacklisted) {
        throw new UnauthorizedError('Token has been revoked')
      }

      return payload
    } catch (error) {
      // Type guard for JWT errors
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedError('Token has expired')
        }
        if (error.name === 'JsonWebTokenError') {
          throw new UnauthorizedError('Invalid token')
        }
      }
      throw error
    }
  }

  /**
   * User login
   */
  async login(dto: LoginDto, ip = 'unknown', userAgent?: string): Promise<AuthResponse> {
    this.logger.info(`Login attempt for email: ${dto.email}`)

    try {
      // Fetch user from database
      const user = await this.userRepository.findByEmail(dto.email)

      if (!user) {
        // Audit failed login
        AuditLogger.logAuth({
          action: 'login',
          email: dto.email,
          ip,
          userAgent,
          success: false,
          reason: 'Invalid credentials',
        })
        // Generic error to prevent user enumeration
        throw new ValidationError('Invalid email or password')
      }

      // Verify password
      const isPasswordValid = await PasswordUtils.compare(dto.password, user.password)

      if (!isPasswordValid) {
        // Audit failed login
        AuditLogger.logAuth({
          action: 'login',
          email: dto.email,
          userId: user.id,
          ip,
          userAgent,
          success: false,
          reason: 'Invalid password',
        })
        throw new ValidationError('Invalid email or password')
      }

      const userRole = this.convertRole(user.role)
      const tokens = this.generateTokens({
        id: user.id,
        email: user.email,
        role: userRole,
      })

      // Store refresh token with TTL
      const refreshTTL = this.parseExpirationToSeconds(Config.JWT_REFRESH_EXPIRES_IN)
      await this.tokenRepository.addToSet(`refresh:${user.id}`, tokens.refreshToken, refreshTTL)

      // Cleanup old expired tokens periodically
      await this.tokenRepository.cleanupExpiredTokens(user.id)

      this.logger.info(`User ${user.email} logged in successfully`)

      // Audit successful login
      AuditLogger.logAuth({
        action: 'login',
        email: user.email,
        userId: user.id,
        ip,
        userAgent,
        success: true,
      })

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: userRole,
        },
      }
    } catch (error) {
      // If not already a ValidationError (i.e., unexpected error), audit it
      if (!(error instanceof ValidationError)) {
        AuditLogger.logAuth({
          action: 'login',
          email: dto.email,
          ip,
          userAgent,
          success: false,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      throw error
    }
  }

  /**
   * User registration
   */
  async register(dto: RegisterDto, ip = 'unknown', userAgent?: string): Promise<AuthResponse> {
    this.logger.info(`Registration attempt for email: ${dto.email}`)

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(dto.email)

    if (existingUser) {
      throw new AlreadyExistsError('User', 'email')
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(dto.password)

    // Create new user
    const userData: CreateUserData = {
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      phone: dto.phone,
      role: Role.USER,
    }
    const newUser = await this.userRepository.create(userData)

    const userRole = this.convertRole(newUser.role)
    const tokens = this.generateTokens({
      id: newUser.id,
      email: newUser.email,
      role: userRole,
    })

    // Store refresh token with TTL
    const refreshTTL = this.parseExpirationToSeconds(Config.JWT_REFRESH_EXPIRES_IN)
    await this.tokenRepository.addToSet(`refresh:${newUser.id}`, tokens.refreshToken, refreshTTL)

    this.logger.info(`User ${newUser.email} registered successfully`)

    // Audit successful registration
    AuditLogger.logAuth({
      action: 'register',
      email: newUser.email,
      userId: newUser.id,
      ip,
      userAgent,
      success: true,
    })

    return {
      ...tokens,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: userRole,
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
    const payload = await this.verifyToken(refreshToken, TOKEN_TYPES.REFRESH)

    // Check if refresh token exists in user's token set (multi-device support)
    const storedTokens = await this.tokenRepository.getSet(`refresh:${payload.id}`)

    if (!storedTokens.includes(refreshToken)) {
      throw new UnauthorizedError('Invalid refresh token')
    }

    // Generate new tokens
    const tokens = this.generateTokens({
      id: payload.id,
      email: payload.email,
      role: payload.role as UserRole,
    })

    // Rotate tokens with TTL
    const refreshTTL = this.parseExpirationToSeconds(Config.JWT_REFRESH_EXPIRES_IN)

    // Remove old refresh token and add new one
    await this.tokenRepository.removeFromSet(`refresh:${payload.id}`, refreshToken)
    await this.tokenRepository.addToSet(`refresh:${payload.id}`, tokens.refreshToken, refreshTTL)

    // Cleanup old expired tokens
    await this.tokenRepository.cleanupExpiredTokens(payload.id)

    this.logger.info(`Tokens refreshed for user ${payload.email}`)

    return tokens
  }

  /**
   * User logout
   */
  async logout(
    userId: string,
    accessToken?: string,
    refreshToken?: string,
    ip = 'unknown',
    userAgent?: string
  ): Promise<void> {
    this.logger.info(`User ${userId} logging out`)

    // Remove specific refresh token from user's token set (for multi-device)
    if (refreshToken) {
      await this.tokenRepository.removeFromSet(`refresh:${userId}`, refreshToken)
    }

    // Blacklist tokens if provided (prevents reuse before expiration)
    if (accessToken) {
      const decoded = jwt.decode(accessToken) as { exp: number } | null
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)
        if (expiresIn > 0) {
          await this.tokenRepository.set(`blacklist:${accessToken}`, '1', expiresIn)
        }
      }
    }

    if (refreshToken) {
      const decoded = jwt.decode(refreshToken) as { exp: number } | null
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)
        if (expiresIn > 0) {
          await this.tokenRepository.set(`blacklist:${refreshToken}`, '1', expiresIn)
        }
      }
    }

    this.logger.info(`User ${userId} logged out successfully`)

    // Audit logout
    AuditLogger.logAuth({
      action: 'logout',
      userId,
      ip,
      userAgent,
      success: true,
    })
  }

  /**
   * Logout from all devices
   * Removes all refresh tokens for the user
   */
  async logoutAllDevices(userId: string): Promise<void> {
    this.logger.info(`User ${userId} logging out from all devices`)

    // Get all refresh tokens
    const tokens = await this.tokenRepository.getSet(`refresh:${userId}`)

    // Blacklist all of them
    for (const token of tokens) {
      const decoded = jwt.decode(token) as { exp: number } | null
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)
        if (expiresIn > 0) {
          await this.tokenRepository.set(`blacklist:${token}`, '1', expiresIn)
        }
      }
    }

    // Delete the entire refresh token set
    await this.tokenRepository.del(`refresh:${userId}`)

    this.logger.info(`User ${userId} logged out from all devices`)
  }
}
