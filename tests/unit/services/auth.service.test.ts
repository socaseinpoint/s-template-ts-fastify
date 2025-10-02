import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { AuthService } from '@/services/auth.service'
import { AppError } from '@/utils/errors'
import { PasswordUtils } from '@/utils/password'
import { Config } from '@/config'

describe('AuthService', () => {
  let authService: AuthService
  let mockRedisService: any

  beforeEach(() => {
    // Create mock Redis service
    mockRedisService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    }

    // Create AuthService and inject mock
    authService = new AuthService()
    // @ts-ignore - accessing private property for testing
    authService['redisService'] = mockRedisService

    vi.clearAllMocks()
  })

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto = {
        email: 'admin@example.com',
        password: 'Admin123!',
      }

      const result = await authService.login(loginDto)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user).toEqual({
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      })
      expect(mockRedisService.set).toHaveBeenCalled()
    })

    it('should throw error for invalid email', async () => {
      const loginDto = {
        email: 'invalid@example.com',
        password: 'Admin123!',
      }

      await expect(authService.login(loginDto)).rejects.toThrow(AppError)
      await expect(authService.login(loginDto)).rejects.toThrow('Invalid email or password')
    })

    it('should throw error for invalid password', async () => {
      const loginDto = {
        email: 'admin@example.com',
        password: 'WrongPassword123!',
      }

      await expect(authService.login(loginDto)).rejects.toThrow(AppError)
      await expect(authService.login(loginDto)).rejects.toThrow('Invalid email or password')
    })

    it('should handle different user roles', async () => {
      const testCases = [
        { email: 'admin@example.com', password: 'Admin123!', role: 'admin' },
        { email: 'moderator@example.com', password: 'Moderator123!', role: 'moderator' },
        { email: 'user@example.com', password: 'User123!', role: 'user' },
      ]

      for (const testCase of testCases) {
        const result = await authService.login({
          email: testCase.email,
          password: testCase.password,
        })
        expect(result.user.role).toBe(testCase.role)
      }
    })
  })

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'NewUser123!',
        name: 'New User',
      }

      const result = await authService.register(registerDto)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user',
      })
      expect(result.user.id).toBeDefined()
      expect(mockRedisService.set).toHaveBeenCalled()
    })

    it('should throw error for existing email', async () => {
      const registerDto = {
        email: 'admin@example.com',
        password: 'NewPassword123!',
        name: 'Another Admin',
      }

      await expect(authService.register(registerDto)).rejects.toThrow(AppError)
      await expect(authService.register(registerDto)).rejects.toThrow(
        'User with this email already exists'
      )
    })

    it('should validate password strength', async () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoNumbers!',
        'NoSpecialChar123',
      ]

      for (const password of weakPasswords) {
        const registerDto = {
          email: 'test@example.com',
          password,
          name: 'Test User',
        }

        await expect(authService.register(registerDto)).rejects.toThrow(AppError)
      }
    })

    it('should accept strong passwords', async () => {
      const strongPassword = 'StrongPass123!'
      const registerDto = {
        email: 'strongpass@example.com',
        password: strongPassword,
        name: 'Strong User',
      }

      const result = await authService.register(registerDto)
      expect(result).toHaveProperty('accessToken')
      expect(mockRedisService.set).toHaveBeenCalled()
    })
  })

  describe('verifyToken', () => {
    it('should verify valid access token', async () => {
      const payload = {
        id: '1',
        email: 'test@example.com',
        role: 'user' as const,
        type: 'access' as const,
      }

      const token = jwt.sign(payload, Config.JWT_SECRET, { expiresIn: '15m' })
      const result = await authService.verifyToken(token, 'access')

      expect(result).toMatchObject(payload)
      expect(mockRedisService.get).toHaveBeenCalledWith(expect.stringContaining('blacklist:'))
    })

    it('should reject expired token', async () => {
      const payload = {
        id: '1',
        email: 'test@example.com',
        role: 'user' as const,
        type: 'access' as const,
      }

      const token = jwt.sign(payload, Config.JWT_SECRET, { expiresIn: '-1s' })

      await expect(authService.verifyToken(token, 'access')).rejects.toThrow('Token has expired')
    })

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here'

      await expect(authService.verifyToken(invalidToken, 'access')).rejects.toThrow('Invalid token')
    })

    it('should reject wrong token type', async () => {
      const payload = {
        id: '1',
        email: 'test@example.com',
        role: 'user' as const,
        type: 'refresh' as const,
      }

      const token = jwt.sign(payload, Config.JWT_SECRET, { expiresIn: '7d' })

      await expect(authService.verifyToken(token, 'access')).rejects.toThrow(
        'Invalid token type. Expected access token'
      )
    })

    it('should reject blacklisted token', async () => {
      const payload = {
        id: '1',
        email: 'test@example.com',
        role: 'user' as const,
        type: 'access' as const,
      }

      const token = jwt.sign(payload, Config.JWT_SECRET, { expiresIn: '15m' })

      // Mock Redis to return blacklisted token
      mockRedisService.get.mockResolvedValueOnce('1')

      await expect(authService.verifyToken(token, 'access')).rejects.toThrow(
        'Token has been revoked'
      )
    })
  })

  describe('refreshToken', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const userId = '1'
      const refreshTokenPayload = {
        id: userId,
        email: 'test@example.com',
        role: 'user' as const,
        type: 'refresh' as const,
      }

      const oldRefreshToken = jwt.sign(refreshTokenPayload, Config.JWT_SECRET, { expiresIn: '7d' })

      // Mock Redis calls in correct order:
      // 1. verifyToken checks blacklist
      // 2. refreshToken checks stored token
      mockRedisService.get
        .mockResolvedValueOnce(null) // blacklist check returns null (not blacklisted)
        .mockResolvedValueOnce(oldRefreshToken) // stored token check returns the token

      const result = await authService.refreshToken(oldRefreshToken)

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.refreshToken).toBeDefined()
      expect(mockRedisService.set).toHaveBeenCalled()
    })

    it('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token'

      await expect(authService.refreshToken(invalidToken)).rejects.toThrow('Invalid token')
    })

    it('should reject refresh token not in Redis', async () => {
      const refreshTokenPayload = {
        id: '1',
        email: 'test@example.com',
        role: 'user' as const,
        type: 'refresh' as const,
      }

      const refreshToken = jwt.sign(refreshTokenPayload, Config.JWT_SECRET, { expiresIn: '7d' })

      // Mock Redis to return null for both checks
      mockRedisService.get
        .mockResolvedValueOnce(null) // blacklist check
        .mockResolvedValueOnce(null) // stored token check (not found)

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const userId = '1'
      const accessToken = jwt.sign(
        { id: userId, email: 'test@example.com', role: 'user', type: 'access' },
        Config.JWT_SECRET,
        { expiresIn: '15m' }
      )
      const refreshToken = jwt.sign(
        { id: userId, email: 'test@example.com', role: 'user', type: 'refresh' },
        Config.JWT_SECRET,
        { expiresIn: '7d' }
      )

      await authService.logout(userId, accessToken, refreshToken)

      // Check if refresh token was removed from Redis
      expect(mockRedisService.del).toHaveBeenCalledWith(`refresh:${userId}`)

      // Check if tokens were blacklisted
      expect(mockRedisService.set).toHaveBeenCalledTimes(2) // Both tokens blacklisted
    })

    it('should handle logout without tokens', async () => {
      const userId = '1'

      await expect(authService.logout(userId)).resolves.not.toThrow()
      expect(mockRedisService.del).toHaveBeenCalledWith(`refresh:${userId}`)
    })
  })

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const user = await authService.getUserById('1')

      expect(user).toEqual({
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      })
    })

    it('should throw error for non-existent user', async () => {
      await expect(authService.getUserById('999')).rejects.toThrow('User not found')
    })
  })
})

describe('PasswordUtils', () => {
  describe('validateStrength', () => {
    it('should validate strong password', () => {
      const result = PasswordUtils.validateStrength('StrongPass123!')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject short password', () => {
      const result = PasswordUtils.validateStrength('Short1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must be at least 8 characters long')
    })

    it('should require uppercase letter', () => {
      const result = PasswordUtils.validateStrength('lowercase123!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should require lowercase letter', () => {
      const result = PasswordUtils.validateStrength('UPPERCASE123!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should require number', () => {
      const result = PasswordUtils.validateStrength('NoNumbers!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one number')
    })

    it('should require special character', () => {
      const result = PasswordUtils.validateStrength('NoSpecial123')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Password must contain at least one special character')
    })
  })
})
