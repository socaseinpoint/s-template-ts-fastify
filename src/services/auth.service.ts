import { Logger } from '@/utils/logger'
import { AppError } from '@/utils/errors'

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

export class AuthService {
  private logger: Logger

  constructor() {
    this.logger = new Logger('AuthService')
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    this.logger.info(`Login attempt for email: ${dto.email}`)

    // Mock authentication logic with different user roles
    const users = [
      {
        email: 'admin@example.com',
        password: 'password123',
        id: '1',
        name: 'Admin User',
        role: 'admin' as const,
      },
      {
        email: 'moderator@example.com',
        password: 'password123',
        id: '2',
        name: 'Moderator User',
        role: 'moderator' as const,
      },
      {
        email: 'user@example.com',
        password: 'password123',
        id: '3',
        name: 'Regular User',
        role: 'user' as const,
      },
    ]

    const user = users.find(u => u.email === dto.email && u.password === dto.password)

    if (user) {
      return {
        accessToken: `access_${Date.now()}_${Math.random().toString(36)}`,
        refreshToken: `refresh_${Date.now()}_${Math.random().toString(36)}`,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      }
    }

    throw new AppError('Invalid email or password', 401)
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    this.logger.info(`Registration attempt for email: ${dto.email}`)

    // Mock registration logic
    // In real implementation, you would:
    // 1. Check if user already exists
    // 2. Hash the password
    // 3. Save user to database
    // 4. Generate tokens

    const userId = Math.random().toString(36).substring(7)

    return {
      accessToken: `access_${Date.now()}_${Math.random().toString(36)}`,
      refreshToken: `refresh_${Date.now()}_${Math.random().toString(36)}`,
      user: {
        id: userId,
        email: dto.email,
        name: dto.name,
        role: 'user',
      },
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.info('Token refresh attempt')

    // Mock token refresh logic
    if (!refreshToken || !refreshToken.startsWith('refresh_')) {
      throw new AppError('Invalid refresh token', 401)
    }

    return {
      accessToken: `access_${Date.now()}_${Math.random().toString(36)}`,
      refreshToken: `refresh_${Date.now()}_${Math.random().toString(36)}`,
    }
  }

  async logout(userId: string): Promise<void> {
    this.logger.info(`User ${userId} logged out`)
    // In real implementation, you would invalidate tokens
    // For example, add them to a blacklist in Redis
  }

  async validateToken(token: string): Promise<boolean> {
    // Mock token validation
    return token.startsWith('access_') || token.startsWith('Bearer telegram_')
  }
}
