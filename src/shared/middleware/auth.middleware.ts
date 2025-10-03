import { FastifyReply, FastifyRequest } from 'fastify'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('AuthMiddleware')

export type UserRole = 'admin' | 'moderator' | 'user'

export interface AuthUser {
  id: string
  email: string
  name?: string
  role: UserRole
}

// Type safety: FastifyRequest.user is already declared in jwt.plugin.ts

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  // Admin has access to everything
  if (userRole === 'admin') return true

  // Check if user's role is in the required roles
  return requiredRoles.includes(userRole)
}

/**
 * Middleware to check if user has required roles
 */
export function requireRoles(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user

    if (!user) {
      logger.warn('No user found in request')
      return reply.code(401).send({
        error: 'Authentication required',
        code: 401,
      })
    }

    if (!hasRole(user.role, roles)) {
      logger.warn(
        `User ${user.id} with role ${user.role} tried to access resource requiring roles: ${roles.join(', ')}`
      )
      return reply.code(403).send({
        error: 'Insufficient permissions',
        code: 403,
        required: roles,
        current: user.role,
      })
    }
  }
}

/**
 * Middleware to check if user is admin
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  return requireRoles(['admin'])(request, reply)
}

/**
 * Middleware to check if user is moderator or admin
 */
export async function requireModerator(request: FastifyRequest, reply: FastifyReply) {
  return requireRoles(['moderator', 'admin'])(request, reply)
}

/**
 * Middleware to check if user is authenticated (any role)
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user

  if (!user) {
    return reply.code(401).send({
      error: 'Authentication required',
      code: 401,
    })
  }
}
