import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import authRoutes from './auth.routes'
import { jwtPlugin } from '@/plugins/jwt.plugin'

describe('Auth Routes Integration Tests', () => {
  let fastify: FastifyInstance
  let accessToken: string
  let refreshToken: string

  beforeAll(async () => {
    fastify = Fastify({ logger: false })
    
    // Register JWT plugin
    await fastify.register(jwtPlugin)
    
    // Register auth routes
    await fastify.register(authRoutes, { prefix: '/auth' })
    
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  beforeEach(() => {
    // Reset tokens
    accessToken = ''
    refreshToken = ''
  })

  describe('POST /auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: `test${Date.now()}@example.com`,
          password: 'TestPass123!',
          name: 'Test User',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('refreshToken')
      expect(body.user).toMatchObject({
        email: expect.stringContaining('@example.com'),
        name: 'Test User',
        role: 'user',
      })
    })

    it('should reject registration with weak password', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'weak@example.com',
          password: 'weak',
          name: 'Weak User',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Password')
    })

    it('should reject registration with invalid email format', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'ValidPass123!',
          name: 'Invalid User',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject registration with missing required fields', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'missing@example.com',
          // Missing password and name
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'Admin123!',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('refreshToken')
      expect(body.user).toMatchObject({
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      })

      // Store tokens for other tests
      accessToken = body.accessToken
      refreshToken = body.refreshToken
    })

    it('should reject login with invalid credentials', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'WrongPassword',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Invalid email or password')
    })

    it('should reject login with non-existent email', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Invalid email or password')
    })

    it('should handle different user roles', async () => {
      const testCases = [
        { email: 'admin@example.com', password: 'Admin123!', role: 'admin' },
        { email: 'moderator@example.com', password: 'Moderator123!', role: 'moderator' },
        { email: 'user@example.com', password: 'User123!', role: 'user' },
      ]

      for (const testCase of testCases) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/auth/login',
          payload: {
            email: testCase.email,
            password: testCase.password,
          },
        })

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.user.role).toBe(testCase.role)
      }
    })
  })

  describe('POST /auth/refresh', () => {
    beforeEach(async () => {
      // Login to get tokens
      const loginResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'Admin123!',
        },
      })
      const body = JSON.parse(loginResponse.body)
      accessToken = body.accessToken
      refreshToken = body.refreshToken
    })

    it('should refresh tokens with valid refresh token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken: refreshToken,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('refreshToken')
      expect(body.accessToken).not.toBe(accessToken)
      expect(body.refreshToken).not.toBe(refreshToken)
    })

    it('should reject refresh with invalid token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken: 'invalid.refresh.token',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toContain('Token refresh failed')
    })

    it('should reject refresh with missing token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /auth/logout', () => {
    beforeEach(async () => {
      // Login to get tokens
      const loginResponse = await fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'Admin123!',
        },
      })
      const body = JSON.parse(loginResponse.body)
      accessToken = body.accessToken
    })

    it('should logout with valid access token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Logged out successfully')
    })

    it('should reject logout without authorization header', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/logout',
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject logout with invalid token format', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: 'InvalidFormat token',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject logout with invalid token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('Token validation', () => {
    it('should validate JWT token structure', () => {
      // This is a simple test to ensure tokens have correct structure
      const loginResponse = fastify.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'Admin123!',
        },
      })

      loginResponse.then(response => {
        const body = JSON.parse(response.body)
        const tokenParts = body.accessToken.split('.')
        
        // JWT should have 3 parts: header.payload.signature
        expect(tokenParts).toHaveLength(3)
        
        // Decode payload (base64)
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
        expect(payload).toHaveProperty('id')
        expect(payload).toHaveProperty('email')
        expect(payload).toHaveProperty('role')
        expect(payload).toHaveProperty('type')
        expect(payload.type).toBe('access')
      })
    })
  })

  describe('Rate limiting', () => {
    it('should handle multiple rapid login attempts', async () => {
      const promises = []
      
      // Attempt 10 rapid logins
      for (let i = 0; i < 10; i++) {
        promises.push(
          fastify.inject({
            method: 'POST',
            url: '/auth/login',
            payload: {
              email: 'admin@example.com',
              password: 'Admin123!',
            },
          })
        )
      }

      const responses = await Promise.all(promises)
      
      // All should succeed for now (rate limiting not implemented)
      // When rate limiting is added, some should return 429
      responses.forEach(response => {
        expect([200, 429]).toContain(response.statusCode)
      })
    })
  })
})
