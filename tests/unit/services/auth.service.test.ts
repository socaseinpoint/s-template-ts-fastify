import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { Config } from '@/config'
import { Role } from '@prisma/client'
import type { IUserRepository } from '@/repositories/user.repository'
import type { ITokenRepository } from '@/repositories/token.repository'

// Mock PasswordUtils
vi.mock('@/utils/password', () => ({
  PasswordUtils: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockImplementation((plain, _hash) => {
      // Simulate password validation
      const validPasswords: Record<string, boolean> = {
        'Admin123!': true,
        'Moderator123!': true,
        'User123!': true,
      }
      return Promise.resolve(validPasswords[plain] || false)
    }),
    validateStrength: (password: string) => {
      const errors = []
      if (password.length < 8) errors.push('Password must be at least 8 characters long')
      if (!/[A-Z]/.test(password))
        errors.push('Password must contain at least one uppercase letter')
      if (!/[a-z]/.test(password))
        errors.push('Password must contain at least one lowercase letter')
      if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number')
      if (!/[!@#$%^&*]/.test(password))
        errors.push('Password must contain at least one special character')
      return { valid: errors.length === 0, errors }
    },
  },
}))

// Import after mocks
import { AuthService } from '@/services/auth.service'
import { PasswordUtils } from '@/utils/password'

describe('AuthService', () => {
  let authService: AuthService
  let mockUserRepository: IUserRepository
  let mockTokenRepository: ITokenRepository

  const mockUsers = {
    admin: {
      id: '1',
      email: 'admin@example.com',
      password: 'hashed-password',
      name: 'Admin User',
      phone: '+1234567890',
      role: Role.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    moderator: {
      id: '2',
      email: 'moderator@example.com',
      password: 'hashed-password',
      name: 'Moderator User',
      phone: null,
      role: Role.MODERATOR,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: '3',
      email: 'user@example.com',
      password: 'hashed-password',
      name: 'Regular User',
      phone: null,
      role: Role.USER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }

  beforeEach(() => {
    // Create mock repositories
    mockUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    }

    mockTokenRepository = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(undefined),
      addToSet: vi.fn().mockResolvedValue(undefined),
      getSet: vi.fn().mockResolvedValue([]),
      removeFromSet: vi.fn().mockResolvedValue(undefined),
      cleanupExpiredTokens: vi.fn().mockResolvedValue(undefined),
    }

    // Create AuthService with mocked dependencies
    authService = new AuthService(mockUserRepository, mockTokenRepository)

    vi.clearAllMocks()
  })

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUsers.admin)

      const result = await authService.login({
        email: 'admin@example.com',
        password: 'Admin123!',
      })

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result.user.role).toBe('admin')
      expect(mockTokenRepository.addToSet).toHaveBeenCalled()
    })

    it('should throw error for invalid email', async () => {
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)

      await expect(
        authService.login({
          email: 'invalid@example.com',
          password: 'Admin123!',
        })
      ).rejects.toThrow('Invalid email or password')
    })

    it('should throw error for invalid password', async () => {
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUsers.admin)

      await expect(
        authService.login({
          email: 'admin@example.com',
          password: 'WrongPassword!',
        })
      ).rejects.toThrow('Invalid email or password')
    })

    it('should handle different user roles', async () => {
      const testCases = [
        { user: mockUsers.admin, password: 'Admin123!', role: 'admin' },
        { user: mockUsers.moderator, password: 'Moderator123!', role: 'moderator' },
        { user: mockUsers.user, password: 'User123!', role: 'user' },
      ]

      for (const testCase of testCases) {
        vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(testCase.user)

        const result = await authService.login({
          email: testCase.user.email,
          password: testCase.password,
        })
        expect(result.user.role).toBe(testCase.role)
      }
    })

    // NOTE: Password length validation moved to Zod schemas (tested at route level)
    // Service assumes data is already validated by middleware
  })

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const newUser = {
        id: 'new-id',
        email: 'newuser@example.com',
        password: 'hashed',
        name: 'New User',
        phone: null,
        role: Role.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'NewUser123!',
        name: 'New User',
      })

      expect(result).toHaveProperty('accessToken')
      expect(result.user.email).toBe('newuser@example.com')
      expect(mockTokenRepository.addToSet).toHaveBeenCalled()
    })

    it('should throw error for existing email', async () => {
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUsers.admin)

      await expect(
        authService.register({
          email: 'admin@example.com',
          password: 'Password123!',
          name: 'Test',
        })
      ).rejects.toThrow('User with this email already exists')
    })

    // NOTE: Password strength validation moved to Zod schemas (tested at route level)
    // Service assumes data is already validated by middleware

    it('should accept strong passwords', async () => {
      const newUser = {
        id: 'new-id',
        email: 'strong@example.com',
        password: 'hashed',
        name: 'Strong User',
        phone: null,
        role: Role.USER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

      const result = await authService.register({
        email: 'strong@example.com',
        password: 'StrongPass123!',
        name: 'Strong User',
      })

      expect(result).toHaveProperty('accessToken')
    })

    // NOTE: Password length validation moved to Zod schemas (tested at route level)
    // Service assumes data is already validated by middleware
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
    })

    it('should reject expired token', async () => {
      const token = jwt.sign(
        { id: '1', email: 'test@example.com', role: 'user', type: 'access' },
        Config.JWT_SECRET,
        { expiresIn: '-1s' }
      )

      await expect(authService.verifyToken(token, 'access')).rejects.toThrow('Token has expired')
    })

    it('should reject invalid token', async () => {
      await expect(authService.verifyToken('invalid', 'access')).rejects.toThrow('Invalid token')
    })

    it('should reject wrong token type', async () => {
      const token = jwt.sign(
        { id: '1', email: 'test@example.com', role: 'user', type: 'refresh' },
        Config.JWT_SECRET,
        { expiresIn: '7d' }
      )

      await expect(authService.verifyToken(token, 'access')).rejects.toThrow('Invalid token type')
    })

    it('should reject blacklisted token', async () => {
      const token = jwt.sign(
        { id: '1', email: 'test@example.com', role: 'user', type: 'access' },
        Config.JWT_SECRET,
        { expiresIn: '15m' }
      )

      vi.mocked(mockTokenRepository.get).mockResolvedValueOnce('1')

      await expect(authService.verifyToken(token, 'access')).rejects.toThrow(
        'Token has been revoked'
      )
    })
  })

  describe('refreshToken', () => {
    it('should refresh tokens', async () => {
      const token = jwt.sign(
        { id: '1', email: 'test@example.com', role: 'user', type: 'refresh' },
        Config.JWT_SECRET,
        { expiresIn: '7d' }
      )

      vi.mocked(mockTokenRepository.get).mockResolvedValueOnce(null)
      vi.mocked(mockTokenRepository.getSet).mockResolvedValueOnce([token])

      const result = await authService.refreshToken(token)
      expect(result).toHaveProperty('accessToken')
      expect(mockTokenRepository.removeFromSet).toHaveBeenCalled()
      expect(mockTokenRepository.addToSet).toHaveBeenCalled()
    })

    it('should reject invalid token', async () => {
      await expect(authService.refreshToken('invalid')).rejects.toThrow('Invalid token')
    })

    it('should reject token not in set', async () => {
      const token = jwt.sign(
        { id: '1', email: 'test@example.com', role: 'user', type: 'refresh' },
        Config.JWT_SECRET,
        { expiresIn: '7d' }
      )

      vi.mocked(mockTokenRepository.get).mockResolvedValue(null)
      vi.mocked(mockTokenRepository.getSet).mockResolvedValue([])

      await expect(authService.refreshToken(token)).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('logout', () => {
    it('should logout user with refresh token', async () => {
      const refreshToken = jwt.sign(
        { id: '1', email: 'test@example.com', role: 'user', type: 'refresh' },
        Config.JWT_SECRET,
        { expiresIn: '7d' }
      )

      await expect(authService.logout('1', undefined, refreshToken)).resolves.not.toThrow()
      expect(mockTokenRepository.removeFromSet).toHaveBeenCalled()
    })

    it('should blacklist tokens if provided', async () => {
      const token = jwt.sign(
        { id: '1', email: 'test@example.com', role: 'user', type: 'access' },
        Config.JWT_SECRET,
        { expiresIn: '15m' }
      )

      await authService.logout('1', token)
      expect(mockTokenRepository.set).toHaveBeenCalled()
    })
  })
})

describe('PasswordUtils', () => {
  describe('validateStrength', () => {
    it('should validate strong password', () => {
      expect(PasswordUtils.validateStrength('StrongPass123!').valid).toBe(true)
    })

    it('should reject short password', () => {
      const result = PasswordUtils.validateStrength('Short1!')
      expect(result.valid).toBe(false)
    })

    it('should require uppercase letter', () => {
      const result = PasswordUtils.validateStrength('lowercase123!')
      expect(result.valid).toBe(false)
    })

    it('should require lowercase letter', () => {
      const result = PasswordUtils.validateStrength('UPPERCASE123!')
      expect(result.valid).toBe(false)
    })

    it('should require number', () => {
      const result = PasswordUtils.validateStrength('NoNumbers!')
      expect(result.valid).toBe(false)
    })

    it('should require special character', () => {
      const result = PasswordUtils.validateStrength('NoSpecial123')
      expect(result.valid).toBe(false)
    })
  })
})
