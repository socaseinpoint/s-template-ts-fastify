import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { loginSchema, registerSchema, refreshSchema } from '@/schemas/auth.schemas'
import { getContainer } from '@/app'
import { RATE_LIMITS } from '@/constants'

export default async function authRoutes(fastify: FastifyInstance) {
  // Get authService from DI container (singleton)
  const container = getContainer()
  if (!container) {
    throw new Error('DI Container not initialized')
  }
  const authService = container.cradle.authService

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
          max: RATE_LIMITS.AUTH.MAX,
          timeWindow: RATE_LIMITS.AUTH.TIMEWINDOW,
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
          max: RATE_LIMITS.AUTH.MAX,
          timeWindow: RATE_LIMITS.AUTH.TIMEWINDOW,
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
    },
    async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
      const result = await authService.refreshToken(request.body.refreshToken)
      return reply.send(result)
    }
  )

  // Logout endpoint
  fastify.post(
    '/logout',
    {
      schema: {
        description: 'User logout',
        tags: ['Auth'],
        headers: {
          type: 'object',
          properties: {
            authorization: { type: 'string', description: 'Bearer token' },
          },
          required: ['authorization'],
        },
        security: [{ Bearer: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Extract tokens from request
      const authorization = request.headers.authorization
      const accessToken = authorization?.substring(7) // Remove 'Bearer ' prefix

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = (request as any).user
      await authService.logout(user.id, accessToken)
      return reply.send({ message: 'Logged out successfully' })
    }
  )
}
