import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { Config } from '@/config'
import { Logger } from '@/shared/utils/logger'
import { UnauthorizedError, ForbiddenError } from '@/shared/utils/errors'
import { UserRole } from '@/constants'

const logger = new Logger('JWTPlugin')

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string
      email: string
      role: UserRole
      type: 'access' | 'refresh'
    }
    user: {
      id: string
      email: string
      role: UserRole
    }
  }
}

export async function jwtPlugin(fastify: FastifyInstance) {
  // Register JWT plugin
  await fastify.register(fastifyJwt, {
    secret: Config.JWT_SECRET,
    sign: {
      expiresIn: Config.JWT_ACCESS_EXPIRES_IN,
    },
    messages: {
      badRequestErrorMessage: 'Format is Authorization: Bearer [token]',
      noAuthorizationInHeaderMessage: 'Authorization header is missing',
      authorizationTokenExpiredMessage: 'Authorization token expired',
      authorizationTokenInvalid: err => {
        return `Authorization token is invalid: ${err.message}`
      },
    },
  })

  /**
   * Authenticate decorator - verify JWT and check blacklist
   */
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // Verify JWT token
      await request.jwtVerify()

      // Get token from header
      const authHeader = request.headers.authorization
      if (!authHeader) {
        throw new UnauthorizedError('Missing authorization header')
      }

      const token = authHeader.replace('Bearer ', '')

      // Check if token is blacklisted (get container from fastify decorator)
      const container = fastify.diContainer
      if (container) {
        const tokenRepository = container.cradle.tokenRepository
        const isBlacklisted = await tokenRepository.get(`blacklist:${token}`)

        if (isBlacklisted) {
          throw new UnauthorizedError('Token has been revoked')
        }
      }
    } catch (err) {
      logger.error('Authentication failed', err)

      if (err instanceof UnauthorizedError) {
        return reply.code(401).send({
          error: err.message,
          code: 401,
        })
      }

      return reply.code(401).send({
        error: 'Invalid or expired token',
        code: 401,
      })
    }
  })

  /**
   * Authorize roles decorator - check if user has required role
   */
  fastify.decorate('authorizeRoles', (...allowedRoles: UserRole[]) => {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        // First authenticate
        await fastify.authenticate(request, reply)

        // Then check roles
        const user = request.user

        if (!user) {
          throw new UnauthorizedError('User not authenticated')
        }

        // Admin always has access
        if (user.role === UserRole.ADMIN) {
          return
        }

        // Check if user has required role
        if (!allowedRoles.includes(user.role)) {
          logger.warn(`User ${user.id} with role ${user.role} attempted unauthorized access`, {
            required: allowedRoles,
            actual: user.role,
          })

          throw new ForbiddenError('Insufficient permissions')
        }
      } catch (err) {
        logger.error('Authorization failed', err)

        if (err instanceof ForbiddenError) {
          return reply.code(403).send({
            error: err.message,
            code: 403,
            required: allowedRoles,
          })
        }

        if (err instanceof UnauthorizedError) {
          return reply.code(401).send({
            error: err.message,
            code: 401,
          })
        }

        return reply.code(401).send({
          error: 'Authentication required',
          code: 401,
        })
      }
    }
  })

  logger.info('JWT plugin registered with authentication decorators')
}

// Type declarations for decorators
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    authorizeRoles: (
      ...roles: UserRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
