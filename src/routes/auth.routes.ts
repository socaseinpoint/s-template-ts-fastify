import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { loginSchema, registerSchema, refreshSchema } from '@/schemas/auth.schemas'
import {
  loginDtoSchema,
  registerDtoSchema,
  refreshTokenDtoSchema,
} from '@/schemas/auth.zod.schemas'
import { validateBody } from '@/middleware/validation.middleware'
import { RATE_LIMITS } from '@/constants'
import { authenticateMiddleware } from '@/middleware/authenticate.middleware'

/**
 * Authentication routes
 * Uses Fastify hooks (NOT Express middleware) for authentication
 */
export default async function authRoutes(fastify: FastifyInstance) {
  // Get authService from DI container
  const authService = fastify.diContainer.cradle.authService

  /**
   * Login endpoint
   * FIXED: Stricter rate limiting per IP to prevent brute force
   */
  fastify.post(
    '/login',
    {
      // FIXED: Zod validation at route level
      preHandler: [validateBody(loginDtoSchema)],
      schema: {
        description: 'User login with email and password',
        tags: ['Auth'],
        body: loginSchema.body,
        response: {
          200: loginSchema.response[200],
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
              details: { type: 'array' },
            },
          },
          429: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
      config: {
        rateLimit: {
          max: RATE_LIMITS.AUTH_LOGIN.MAX,
          timeWindow: RATE_LIMITS.AUTH_LOGIN.TIMEWINDOW,
          ban: RATE_LIMITS.AUTH_LOGIN.BAN,
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { email: string; password: string } }>,
      reply: FastifyReply
    ) => {
      const result = await authService.login(request.body)
      return reply.send(result)
    }
  )

  /**
   * Register endpoint
   * FIXED: Rate limiting to prevent spam registrations
   */
  fastify.post(
    '/register',
    {
      // FIXED: Zod validation with strong password requirements
      preHandler: [validateBody(registerDtoSchema)],
      schema: {
        description: 'User registration with strong password requirements',
        tags: ['Auth'],
        body: registerSchema.body,
        response: {
          201: registerSchema.response[201],
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
              details: { type: 'array' },
            },
          },
        },
      },
      config: {
        rateLimit: {
          max: RATE_LIMITS.AUTH_REGISTER.MAX,
          timeWindow: RATE_LIMITS.AUTH_REGISTER.TIMEWINDOW,
          ban: RATE_LIMITS.AUTH_REGISTER.BAN,
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: { email: string; password: string; name: string; phone?: string }
      }>,
      reply: FastifyReply
    ) => {
      const result = await authService.register(request.body)
      return reply.code(201).send(result)
    }
  )

  /**
   * Refresh token endpoint
   */
  fastify.post(
    '/refresh',
    {
      preHandler: [validateBody(refreshTokenDtoSchema)],
      schema: {
        description: 'Refresh access token using refresh token',
        tags: ['Auth'],
        body: refreshSchema.body,
        response: {
          200: refreshSchema.response[200],
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
      config: {
        rateLimit: {
          max: RATE_LIMITS.AUTH_REFRESH.MAX,
          timeWindow: RATE_LIMITS.AUTH_REFRESH.TIMEWINDOW,
          ban: RATE_LIMITS.AUTH_REFRESH.BAN,
        },
      },
    },
    async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
      const result = await authService.refreshToken(request.body.refreshToken)
      return reply.send(result)
    }
  )

  /**
   * Logout endpoint
   * Uses Fastify preHandler hook (not Express middleware!)
   */
  fastify.post(
    '/logout',
    {
      // IMPORTANT: This is a Fastify hook, not Express middleware
      preHandler: [authenticateMiddleware],
      schema: {
        description: 'User logout (revokes current session tokens)',
        tags: ['Auth'],
        security: [{ Bearer: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Extract tokens from request
      const authorization = request.headers.authorization
      const accessToken = authorization?.substring(7) // Remove 'Bearer ' prefix

      const user = request.user!
      await authService.logout(user.id, accessToken)

      return reply.send({ message: 'Logged out successfully' })
    }
  )

  /**
   * Logout from all devices
   * BONUS: New endpoint for security
   */
  fastify.post(
    '/logout-all',
    {
      preHandler: [authenticateMiddleware],
      schema: {
        description: 'Logout from all devices (revokes all refresh tokens)',
        tags: ['Auth'],
        security: [{ Bearer: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user!
      await authService.logoutAllDevices(user.id)

      return reply.send({ message: 'Logged out from all devices successfully' })
    }
  )
}
