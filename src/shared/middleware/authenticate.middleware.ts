import { FastifyReply, FastifyRequest } from 'fastify'

/**
 * Authentication middleware - требует чтобы fastify.authenticate был зарегистрирован
 */
export async function authenticateMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    return reply.code(401).send({
      error: 'Invalid or expired token',
      code: 401,
    })
  }
}

/**
 * Helper для создания role-based middleware
 */
export function authorizeRoles(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      // First authenticate
      await request.jwtVerify()

      const user = request.user

      if (!user) {
        return reply.code(401).send({
          error: 'User not authenticated',
          code: 401,
        })
      }

      // Admin always has access
      if (user.role === 'admin') {
        return
      }

      // Check if user has required role
      if (!allowedRoles.includes(user.role)) {
        return reply.code(403).send({
          error: 'Insufficient permissions',
          code: 403,
          required: allowedRoles,
        })
      }
    } catch (err) {
      return reply.code(401).send({
        error: 'Authentication required',
        code: 401,
      })
    }
  }
}
