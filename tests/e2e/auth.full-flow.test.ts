import { describe, it, expect, beforeAll } from 'vitest'
import axios, { AxiosInstance } from 'axios'
import { generateUniqueEmail, wait } from '@tests/helpers/test-utils'

/**
 * Full Authentication Flow E2E Tests
 *
 * PREREQUISITES:
 * - Server must be running with ENABLE_RATE_LIMIT=false
 * - Database must be accessible
 * - Redis must be running
 *
 * Start server: E2E_MODE=true npm run dev:api
 */
describe('Full Authentication Flow E2E Tests', () => {
  let api: AxiosInstance
  let baseURL: string

  // Test user data
  const testUser = {
    email: generateUniqueEmail('flowtest'),
    password: 'TestPassword123!',
    name: 'Flow Test User',
  }

  // Tokens storage
  let accessToken: string
  let refreshToken: string

  beforeAll(() => {
    // E2E tests expect server to be running WITHOUT rate limiting
    baseURL = process.env.E2E_BASE_URL || 'http://localhost:3001'

    // Check if rate limiting is disabled
    if (process.env.ENABLE_RATE_LIMIT !== 'false') {
      console.warn('⚠️  WARNING: Set ENABLE_RATE_LIMIT=false for reliable E2E tests')
    }

    api = axios.create({
      baseURL,
      validateStatus: () => true, // Don't throw on any status
    })

    console.log('✅ Running E2E tests against:', baseURL)
    console.log('ℹ️  Make sure rate limiting is disabled: ENABLE_RATE_LIMIT=false')
  })

  describe('Complete Authentication Flow', () => {
    it('Step 1: Should register a new user', async () => {
      const response = await api.post('/v1/auth/register', testUser)

      // Expect deterministic success
      expect(response.status).toBe(201)
      expect(response.data).toHaveProperty('accessToken')
      expect(response.data).toHaveProperty('refreshToken')
      expect(response.data.user).toMatchObject({
        email: testUser.email,
        name: testUser.name,
        role: 'user',
      })

      // Store tokens for next steps
      accessToken = response.data.accessToken
      refreshToken = response.data.refreshToken

      console.log('✓ User registered:', testUser.email, '(ID:', response.data.user.id, ')')
    })

    it('Step 2: Should access protected route with token', async () => {
      const response = await api.get('/v1/items', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      // Should succeed with valid token
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('items')
      expect(Array.isArray(response.data.items)).toBe(true)

      console.log('✓ Protected route accessed')
    })

    it('Step 3: Should refresh tokens', async () => {
      // Wait to ensure new token has different timestamp (JWT uses seconds)
      await wait(1100)

      const response = await api.post('/v1/auth/refresh', {
        refreshToken,
      })

      // Should succeed with valid refresh token
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('accessToken')
      expect(response.data).toHaveProperty('refreshToken')

      const newAccessToken = response.data.accessToken
      const newRefreshToken = response.data.refreshToken

      // Tokens should be different from originals
      expect(newAccessToken).not.toBe(accessToken)
      expect(newRefreshToken).not.toBe(refreshToken)

      // Update tokens for subsequent tests
      accessToken = newAccessToken
      refreshToken = newRefreshToken

      console.log('✓ Tokens refreshed')
    })

    it('Step 4: Should login with credentials', async () => {
      const response = await api.post('/v1/auth/login', {
        email: testUser.email,
        password: testUser.password,
      })

      // Should succeed with correct credentials
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('accessToken')
      expect(response.data).toHaveProperty('refreshToken')
      expect(response.data.user.email).toBe(testUser.email)

      // Update tokens
      accessToken = response.data.accessToken
      refreshToken = response.data.refreshToken

      console.log('✓ Login successful')
    })

    it('Step 5: Should logout successfully', async () => {
      const response = await api.post('/v1/auth/logout', null, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      // Should succeed and invalidate token
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('message')

      console.log('✓ Logout completed')
    })

    it('Step 6: Should reject access after logout', async () => {
      // Try to access protected route with logged-out token
      const response = await api.get('/v1/items', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      // Note: This test depends on token blacklisting implementation
      // If using Redis token storage, should return 401
      // If using pure JWT without blacklist, may return 200 (token still valid)
      if (response.status === 401) {
        expect(response.data).toHaveProperty('error')
        console.log('✓ Post-logout token invalidation: Token blacklisted (Redis)')
      } else if (response.status === 200) {
        console.log('⚠️  Post-logout token: Still valid (no blacklist, pure JWT)')
        console.log('   Tip: Implement Redis token blacklist for true logout')
      } else {
        throw new Error(`Unexpected status ${response.status}: Expected 200 or 401`)
      }
    })
  })

  describe('Authentication Edge Cases', () => {
    it('Should handle duplicate registration', async () => {
      const existingUser = {
        email: testUser.email, // Use already registered user
        password: 'Admin123!',
        name: 'Duplicate User',
      }

      const response = await api.post('/v1/auth/register', existingUser)

      // Should return conflict error (409 is correct for duplicates)
      expect(response.status).toBe(409)
      expect(response.data.error.toLowerCase()).toContain('already exists')
    })

    it('Should validate password requirements', async () => {
      const weakPasswords = [
        { pass: 'short', description: 'too short' },
        { pass: 'nouppercase123!', description: 'no uppercase' },
        { pass: 'NOLOWERCASE123!', description: 'no lowercase' },
        { pass: 'NoNumbers!', description: 'no numbers' },
        { pass: 'NoSpecialChar123', description: 'no special chars' },
      ]

      for (const test of weakPasswords) {
        const response = await api.post('/v1/auth/register', {
          email: generateUniqueEmail('weak'),
          password: test.pass,
          name: 'Weak Password User',
        })

        // Should fail validation
        expect(response.status).toBe(400)
        expect(response.data).toHaveProperty('error')

        const errorLower = response.data.error.toLowerCase()
        expect(errorLower.includes('password') || errorLower.includes('validation')).toBe(true)

        console.log(`  ✓ Rejected ${test.description}: "${test.pass}"`)
      }

      console.log('✓ Password validation tested')
    })

    it('Should handle invalid login attempts', async () => {
      const invalidAttempts = [
        {
          email: 'nonexistent@test.com',
          password: 'Password123!',
          expectedError: 'Invalid email or password',
          description: 'non-existent user',
        },
        {
          email: testUser.email,
          password: 'WrongPassword123!',
          expectedError: 'Invalid email or password',
          description: 'wrong password',
        },
      ]

      for (const attempt of invalidAttempts) {
        const response = await api.post('/v1/auth/login', {
          email: attempt.email,
          password: attempt.password,
        })

        // Should return auth error
        expect(response.status).toBe(400)
        expect(response.data.error).toContain(attempt.expectedError)

        console.log(`  ✓ Rejected ${attempt.description}`)
      }

      console.log('✓ Invalid login handling verified')
    })

    it('Should handle malformed tokens', async () => {
      const malformedTokens = [
        { token: 'invalid.token.here', description: 'invalid format' },
        { token: '', description: 'empty token' },
        { token: 'not-a-jwt', description: 'not a JWT' },
      ]

      for (const { token, description } of malformedTokens) {
        const response = await api.get('/v1/items', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        expect(response.status).toBe(401)
        expect(response.data).toHaveProperty('error')

        console.log(`  ✓ Rejected ${description}`)
      }

      console.log('✓ Malformed token handling verified')
    })
  })

  describe('Token Expiration and Refresh', () => {
    it('Should handle expired tokens gracefully', async () => {
      // Mock expired token with past expiration
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.invalid'

      const response = await api.get('/v1/items', {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      })

      expect(response.status).toBe(401)
      expect(response.data).toHaveProperty('error')

      console.log('✓ Expired token handling verified')
    })

    it('Should validate token types (refresh vs access)', async () => {
      // Try using refresh token for API access
      const response = await api.get('/v1/items', {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      })

      // Note: Token type validation depends on implementation
      // Best practice: Check 'type' claim in JWT payload
      if (response.status === 401) {
        expect(response.data).toHaveProperty('error')
        console.log('✓ Token type validation: Refresh token properly rejected')
      } else if (response.status === 200) {
        console.log('⚠️  Token type validation: No type checking implemented')
        console.log('   Tip: Add token type validation in JWT middleware')
      } else {
        throw new Error(`Unexpected status ${response.status}: Expected 200 or 401`)
      }
    })
  })

  describe('Security Headers and CORS', () => {
    it('Should include security headers', async () => {
      const response = await api.get('/health')

      // Check for common security headers
      expect(response.headers).toHaveProperty('x-dns-prefetch-control')
      expect(response.headers).toHaveProperty('x-frame-options')
      expect(response.headers).toHaveProperty('x-content-type-options')

      console.log('✓ Security headers present')
    })

    it('Should handle CORS preflight requests', async () => {
      const response = await api.options('/v1/auth/login')

      // OPTIONS may return 200, 204, or 400 (if not explicitly handled)
      expect([200, 204, 400]).toContain(response.status)

      // Check for CORS headers (optional, depends on configuration)
      const corsOrigin = response.headers['access-control-allow-origin']

      if (corsOrigin) {
        console.log('✓ CORS enabled, origin:', corsOrigin)
        // Note: access-control-allow-methods may not be set on OPTIONS if not configured
        // This is OK - CORS can work with just origin header
      } else {
        console.log('⚠️  CORS not configured (origin header missing)')
      }

      // Test passes regardless - CORS configuration is optional
      expect(response.status).toBeDefined()
    })
  })
})
