import jwt from 'jsonwebtoken'
import { Logger } from '@/utils/logger'
import { AppError } from '@/utils/errors'
import { PasswordUtils } from '@/utils/password'
import { Config } from '@/config'
import { IUserRepository } from '@/repositories/user.repository'
import { ITokenRepository } from '@/repositories/token.repository'
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

  constructor(
    private userRepository: IUserRepository,
    private tokenRepository: ITokenRepository
  ) {
    this.logger = new Logger('AuthService')
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

      // Check if token is blacklisted
      const isBlacklisted = await this.tokenRepository.get(`blacklist:${token}`)
      if (isBlacklisted) {
        throw new AppError('Token has been revoked', 401)
      }

      return payload
    } catch (error) {
      // Type guard for JWT errors
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          throw new AppError('Token has expired', 401)
        }
        if (error.name === 'JsonWebTokenError') {
          throw new AppError('Invalid token', 401)
        }
      }
      throw error
    }
  }

  /**
   * User login
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    this.logger.info(`Login attempt for email: ${dto.email}`)

    // Validate password length to prevent DoS via bcrypt
    if (dto.password.length > 72) {
      throw new AppError('Password too long', 400)
    }

    // Fetch user from database via repository
    const user = await this.userRepository.findByEmail(dto.email)

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

    // Store refresh token for multi-device support
    await this.tokenRepository.addToSet(`refresh:${user.id}`, tokens.refreshToken)

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

    // Validate password length to prevent DoS
    if (dto.password.length > 72) {
      throw new AppError('Password too long', 400)
    }

    // Validate password strength
    const passwordValidation = PasswordUtils.validateStrength(dto.password)
    if (!passwordValidation.valid) {
      throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400)
    }

    // Check if user already exists via repository
    const existingUser = await this.userRepository.findByEmail(dto.email)

    if (existingUser) {
      throw new AppError('User with this email already exists', 400)
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(dto.password)

    // Create new user via repository
    const newUser = await this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      phone: dto.phone,
      role: Role.USER,
    })

    const tokens = this.generateTokens({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role.toLowerCase() as 'admin' | 'moderator' | 'user',
    })

    // Store refresh token for multi-device support
    await this.tokenRepository.addToSet(`refresh:${newUser.id}`, tokens.refreshToken)

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

    // Check if refresh token exists in user's token set (multi-device support)
    const storedTokens = await this.tokenRepository.getSet(`refresh:${payload.id}`)

    if (!storedTokens.includes(refreshToken)) {
      throw new AppError('Invalid refresh token', 401)
    }

    // Generate new tokens
    const tokens = this.generateTokens({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    })

    // Remove old refresh token and add new one
    await this.tokenRepository.removeFromSet(`refresh:${payload.id}`, refreshToken)
    await this.tokenRepository.addToSet(`refresh:${payload.id}`, tokens.refreshToken)

    this.logger.info(`Tokens refreshed for user ${payload.email}`)

    return tokens
  }

  /**
   * User logout
   */
  async logout(userId: string, accessToken?: string, refreshToken?: string): Promise<void> {
    this.logger.info(`User ${userId} logging out`)

    // Remove specific refresh token from user's token set (for multi-device)
    if (refreshToken) {
      await this.tokenRepository.removeFromSet(`refresh:${userId}`, refreshToken)
    }

    // Blacklist tokens if provided
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
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new AppError('User not found', 404)
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase() as 'admin' | 'moderator' | 'user',
    }
  }
}
