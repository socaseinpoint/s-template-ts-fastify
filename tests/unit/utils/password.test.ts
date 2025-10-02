import { describe, it, expect } from 'vitest'
import { PasswordUtils } from '@/utils/password'

describe('PasswordUtils', () => {
  describe('hash and compare', () => {
    it('should hash password and verify it correctly', async () => {
      const password = 'TestPassword123!'
      const hashed = await PasswordUtils.hash(password)

      expect(hashed).not.toBe(password)
      expect(hashed.length).toBeGreaterThan(20)

      const isValid = await PasswordUtils.compare(password, hashed)
      expect(isValid).toBe(true)
    })

    it('should reject wrong password', async () => {
      const password = 'TestPassword123!'
      const wrongPassword = 'WrongPassword123!'
      const hashed = await PasswordUtils.hash(password)

      const isValid = await PasswordUtils.compare(wrongPassword, hashed)
      expect(isValid).toBe(false)
    })
  })

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

    it('should return multiple errors for weak password', () => {
      const result = PasswordUtils.validateStrength('weak')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })
})

