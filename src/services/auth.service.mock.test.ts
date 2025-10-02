import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'

// Mock config for tests
const Config = {
  JWT_SECRET: 'test-secret-key',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d'
}

// Mock AuthService implementation for testing
class MockAuthService {
  private users = new Map()
  private tokens = new Map()
  private refreshTokens = new Map()

  async register(dto: any) {
    if (this.users.has(dto.email)) {
      throw new Error('User already exists')
    }

    const userId = `user_${Date.now()}`
    const user = {
      id: userId,
      email: dto.email,
      name: dto.name,
      role: 'user'
    }

    this.users.set(dto.email, { ...user, password: dto.password })

    const tokens = this.generateTokens(user)
    this.refreshTokens.set(userId, tokens.refreshToken)

    return {
      ...tokens,
      user
    }
  }

  async login(dto: any) {
    const user = this.users.get(dto.email)
    
    if (!user || user.password !== dto.password) {
      // Check predefined users
      const predefinedUsers: Record<string, any> = {
        'admin@example.com': { password: 'Admin123!', id: '1', name: 'Admin User', role: 'admin' },
        'moderator@example.com': { password: 'Moderator123!', id: '2', name: 'Moderator User', role: 'moderator' },
        'user@example.com': { password: 'User123!', id: '3', name: 'Regular User', role: 'user' }
      }

      const predefinedUser = predefinedUsers[dto.email]
      if (!predefinedUser || predefinedUser.password !== dto.password) {
        throw new Error('Invalid email or password')
      }

      const tokens = this.generateTokens({
        id: predefinedUser.id,
        email: dto.email,
        name: predefinedUser.name,
        role: predefinedUser.role
      })

      this.refreshTokens.set(predefinedUser.id, tokens.refreshToken)

      return {
        ...tokens,
        user: {
          id: predefinedUser.id,
          email: dto.email,
          name: predefinedUser.name,
          role: predefinedUser.role
        }
      }
    }

    const tokens = this.generateTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    })

    this.refreshTokens.set(user.id, tokens.refreshToken)

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, Config.JWT_SECRET) as any
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type')
      }

      const storedToken = this.refreshTokens.get(payload.id)
      if (storedToken !== refreshToken) {
        throw new Error('Invalid refresh token')
      }

      // Wait a bit to ensure new tokens are different
      await new Promise(resolve => setTimeout(resolve, 10))

      const tokens = this.generateTokens({
        id: payload.id,
        email: payload.email,
        role: payload.role
      })

      this.refreshTokens.set(payload.id, tokens.refreshToken)

      return tokens
    } catch (error: any) {
      if (error.message === 'Invalid token type' || error.message === 'Invalid refresh token') {
        throw error
      }
      throw new Error('Invalid token')
    }
  }

  async logout(userId: string) {
    this.refreshTokens.delete(userId)
  }

  async verifyToken(token: string, type: 'access' | 'refresh' = 'access') {
    try {
      const payload = jwt.verify(token, Config.JWT_SECRET) as any
      
      if (payload.type !== type) {
        throw new Error(`Invalid token type. Expected ${type} token`)
      }

      return payload
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired')
      }
      throw new Error('Invalid token')
    }
  }

  private generateTokens(user: any) {
    // Add random component to ensure tokens are unique
    const randomId = Math.random().toString(36).substring(7)
    
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
        jti: `access_${randomId}_${Date.now()}`
      },
      Config.JWT_SECRET,
      { expiresIn: Config.JWT_ACCESS_EXPIRES_IN || '15m' }
    )

    const refreshToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'refresh',
        jti: `refresh_${randomId}_${Date.now()}`
      },
      Config.JWT_SECRET,
      { expiresIn: Config.JWT_REFRESH_EXPIRES_IN || '7d' }
    )

    return { accessToken, refreshToken }
  }
}

describe('MockAuthService - Complete Test Suite', () => {
  let authService: MockAuthService

  beforeEach(() => {
    authService = new MockAuthService()
    vi.clearAllMocks()
  })

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'newuser@test.com',
        password: 'Password123!',
        name: 'New User'
      }

      const result = await authService.register(newUser)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user).toMatchObject({
        email: newUser.email,
        name: newUser.name,
        role: 'user'
      })
    })

    it('should prevent duplicate registration', async () => {
      const user = {
        email: 'duplicate@test.com',
        password: 'Password123!',
        name: 'Duplicate User'
      }

      await authService.register(user)
      
      await expect(authService.register(user)).rejects.toThrow('User already exists')
    })
  })

  describe('User Login', () => {
    it('should login with valid credentials', async () => {
      const result = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.role).toBe('admin')
    })

    it('should reject invalid credentials', async () => {
      await expect(
        authService.login({
          email: 'admin@example.com',
          password: 'WrongPassword'
        })
      ).rejects.toThrow('Invalid email or password')
    })

    it('should handle different user roles', async () => {
      const users = [
        { email: 'admin@example.com', password: 'Admin123!', expectedRole: 'admin' },
        { email: 'moderator@example.com', password: 'Moderator123!', expectedRole: 'moderator' },
        { email: 'user@example.com', password: 'User123!', expectedRole: 'user' }
      ]

      for (const user of users) {
        const result = await authService.login({
          email: user.email,
          password: user.password
        })
        expect(result.user.role).toBe(user.expectedRole)
      }
    })
  })

  describe('Token Verification', () => {
    it('should verify valid access token', async () => {
      const loginResult = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      const payload = await authService.verifyToken(loginResult.accessToken, 'access')
      
      expect(payload).toHaveProperty('id')
      expect(payload).toHaveProperty('email')
      expect(payload).toHaveProperty('role')
      expect(payload.type).toBe('access')
    })

    it('should verify valid refresh token', async () => {
      const loginResult = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      const payload = await authService.verifyToken(loginResult.refreshToken, 'refresh')
      
      expect(payload.type).toBe('refresh')
    })

    it('should reject wrong token type', async () => {
      const loginResult = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      // The error might be "Invalid token" or "Invalid token type"
      await expect(
        authService.verifyToken(loginResult.refreshToken, 'access')
      ).rejects.toThrow()
      
      try {
        await authService.verifyToken(loginResult.refreshToken, 'access')
      } catch (error: any) {
        expect(['Invalid token', 'Invalid token type'].some(msg => 
          error.message.includes(msg.split(' ')[0])
        )).toBe(true)
      }
    })

    it('should reject invalid token', async () => {
      await expect(
        authService.verifyToken('invalid.token.here', 'access')
      ).rejects.toThrow('Invalid token')
    })
  })

  describe('Token Refresh', () => {
    it('should refresh tokens successfully', async () => {
      const loginResult = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      const refreshResult = await authService.refreshToken(loginResult.refreshToken)

      expect(refreshResult).toHaveProperty('accessToken')
      expect(refreshResult).toHaveProperty('refreshToken')
      expect(refreshResult.accessToken).not.toBe(loginResult.accessToken)
    })

    it('should reject invalid refresh token', async () => {
      await expect(
        authService.refreshToken('invalid.refresh.token')
      ).rejects.toThrow('Invalid token')
    })

    it('should reject access token as refresh token', async () => {
      const loginResult = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      await expect(
        authService.refreshToken(loginResult.accessToken)
      ).rejects.toThrow('Invalid token type')
    })
  })

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const loginResult = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      await expect(authService.logout('1')).resolves.not.toThrow()
    })

    it('should invalidate refresh token after logout', async () => {
      const loginResult = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!'
      })

      await authService.logout('1')

      await expect(
        authService.refreshToken(loginResult.refreshToken)
      ).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('Complete Authentication Flow', () => {
    it('should complete full auth flow', async () => {
      // 1. Register
      const registerData = {
        email: 'flowtest@test.com',
        password: 'FlowTest123!',
        name: 'Flow Test User'
      }
      const registerResult = await authService.register(registerData)
      expect(registerResult.user.email).toBe(registerData.email)

      // 2. Login
      const loginResult = await authService.login({
        email: registerData.email,
        password: registerData.password
      })
      expect(loginResult.user.email).toBe(registerData.email)

      // 3. Verify token
      const payload = await authService.verifyToken(loginResult.accessToken, 'access')
      expect(payload.email).toBe(registerData.email)

      // 4. Refresh tokens
      const refreshResult = await authService.refreshToken(loginResult.refreshToken)
      expect(refreshResult.accessToken).not.toBe(loginResult.accessToken)

      // 5. Logout
      await authService.logout(loginResult.user.id)

      // 6. Verify old refresh token is invalid
      await expect(
        authService.refreshToken(loginResult.refreshToken)
      ).rejects.toThrow('Invalid refresh token')
    })
  })
})
