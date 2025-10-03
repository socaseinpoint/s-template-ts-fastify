import { FastifyInstance } from 'fastify'
import {
  loginResponseSchema,
  registerResponseSchema,
  refreshTokenResponseSchema,
  logoutResponseSchema,
  errorResponseSchema,
} from '@/schemas/auth.schemas'
import { loginDtoSchema, registerDtoSchema, refreshTokenDtoSchema } from '@/dto/auth.dto'
import { RATE_LIMITS } from '@/constants'
import { authenticateMiddleware } from '@/middleware/authenticate.middleware'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * Authentication routes
 * Uses Fastify hooks (NOT Express middleware) for authentication
 */
export default async function authRoutes(fastify: FastifyInstance) {
  // Get authService from DI container
  const authService = fastify.diContainer.cradle.authService

  /**
   * Login endpoint with rate limiting
   */
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/login',
    {
      schema: {
        description: 'User login with email and password',
        tags: ['Auth'],
        body: loginDtoSchema,
        response: {
          200: loginResponseSchema,
          400: errorResponseSchema,
          429: errorResponseSchema,
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
    async (request, reply) => {
      const result = await authService.login(request.body)
      return reply.send(result)
    }
  )

  /**
   * Register endpoint with spam prevention
   */
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/register',
    {
      schema: {
        description: 'User registration with strong password requirements',
        tags: ['Auth'],
        body: registerDtoSchema,
        response: {
          201: registerResponseSchema,
          400: errorResponseSchema,
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
    async (request, reply) => {
      const result = await authService.register(request.body)
      return reply.code(201).send(result)
    }
  )

  /**
   * Refresh token endpoint
   */
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/refresh',
    {
      schema: {
        description: 'Refresh access token using refresh token',
        tags: ['Auth'],
        body: refreshTokenDtoSchema,
        response: {
          200: refreshTokenResponseSchema,
          401: errorResponseSchema,
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
    async (request, reply) => {
      const result = await authService.refreshToken(request.body.refreshToken)
      return reply.send(result)
    }
  )

  /**
   * Logout endpoint
   * Uses Fastify preHandler hook (not Express middleware!)
   */
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/logout',
    {
      // IMPORTANT: This is a Fastify hook, not Express middleware
      preHandler: [authenticateMiddleware],
      schema: {
        description: 'User logout (revokes current session tokens)',
        tags: ['Auth'],
        security: [{ Bearer: [] }],
        response: {
          200: logoutResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // Extract tokens from request
      const authorization = request.headers.authorization
      const accessToken = authorization?.substring(7) // Remove 'Bearer ' prefix

      const user = request.user
      await authService.logout(user.id, accessToken)

      return reply.send({ message: 'Logged out successfully' })
    }
  )

  /**
   * Logout from all devices
   * BONUS: New endpoint for security
   */
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/logout-all',
    {
      preHandler: [authenticateMiddleware],
      schema: {
        description: 'Logout from all devices (revokes all refresh tokens)',
        tags: ['Auth'],
        security: [{ Bearer: [] }],
        response: {
          200: logoutResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = request.user
      await authService.logoutAllDevices(user.id)

      return reply.send({ message: 'Logged out from all devices successfully' })
    }
  )
}
