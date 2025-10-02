import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AuthService } from '@/services/auth.service'
import { loginSchema, registerSchema, refreshSchema } from '@/schemas/auth.schemas'

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService()

  // Login endpoint
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
    },
    async (request: FastifyRequest<{ Body: typeof loginSchema.body }>, reply: FastifyReply) => {
      try {
        const result = await authService.login(request.body)
        return reply.send(result)
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : 'Login failed',
          code: 400,
        })
      }
    }
  )

  // Register endpoint
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
    },
    async (request: FastifyRequest<{ Body: typeof registerSchema.body }>, reply: FastifyReply) => {
      try {
        const result = await authService.register(request.body)
        return reply.code(201).send(result)
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : 'Registration failed',
          code: 400,
        })
      }
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
    async (request: FastifyRequest<{ Body: typeof refreshSchema.body }>, reply: FastifyReply) => {
      try {
        const result = await authService.refreshToken(request.body.refreshToken)
        return reply.send(result)
      } catch (error) {
        return reply.code(401).send({
          error: error instanceof Error ? error.message : 'Token refresh failed',
          code: 401,
        })
      }
    }
  )

  // Logout endpoint
  fastify.post(
    '/logout',
    {
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
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user
        await authService.logout(user.id)
        return reply.send({ message: 'Logged out successfully' })
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Logout failed',
          code: 500,
        })
      }
    }
  )
}
