import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { Config } from '@/config'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string
      email: string
      role: 'admin' | 'moderator' | 'user'
    }
    user: {
      id: string
      email: string
      role: 'admin' | 'moderator' | 'user'
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    jwt: {
      verify: () => Promise<any>
      sign: (payload: any, options?: any) => string
    }
    user?: {
      id: string
      email: string
      role: 'admin' | 'moderator' | 'user'
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
  })

  // Decorate fastify instance with authenticate method
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
    }
  })

  // Decorate with role-based authentication
  fastify.decorate(
    'authorizeRoles',
    (...allowedRoles: string[]) =>
      async function (request: FastifyRequest, reply: FastifyReply) {
        try {
          await request.jwtVerify()
          const user = request.user

          if (!user || !allowedRoles.includes(user.role)) {
            return reply.code(403).send({
              error: 'Forbidden',
              message: 'You do not have permission to access this resource',
            })
          }
        } catch (err) {
          reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
        }
      }
  )
}

// Type declarations for decorators
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    authorizeRoles: (
      ...roles: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
