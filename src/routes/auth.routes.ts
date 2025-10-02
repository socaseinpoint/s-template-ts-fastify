import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { loginSchema, registerSchema, refreshSchema } from '@/schemas/auth.schemas'
import { RATE_LIMITS } from '@/constants'
import { authenticateMiddleware } from '@/middleware/authenticate.middleware'

export default async function authRoutes(fastify: FastifyInstance) {
  // Get authService from DI container via fastify decorator
  const authService = fastify.diContainer.cradle.authService

  // Login endpoint with stricter rate limiting
  fastify.post(
    '/login',
    {
      schema: {
        description: 'User login',
        tags: ['Auth'],
        body: loginSchema.body,
        response: {
          200: loginSchema.response[200],
          400: {
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
      // No try-catch needed - centralized error handler will catch everything
      const result = await authService.login(request.body)
      return reply.send(result)
    }
  )

  // Register endpoint with stricter rate limiting
  fastify.post(
    '/register',
    {
      schema: {
        description: 'User registration',
        tags: ['Auth'],
        body: registerSchema.body,
        response: {
          201: registerSchema.response[201],
          400: {
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

  // Refresh token endpoint
  fastify.post(
    '/refresh',
    {
      schema: {
        description: 'Refresh access token',
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

  // Logout endpoint (requires authentication)
  fastify.post(
    '/logout',
    {
      onRequest: [authenticateMiddleware],
      schema: {
        description: 'User logout',
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
}
