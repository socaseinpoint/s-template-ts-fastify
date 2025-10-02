import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { userSchema, updateUserSchema } from '@/schemas/user.schemas'
import { UserRole } from '@/constants'
import { authenticateMiddleware, authorizeRoles } from '@/middleware/authenticate.middleware'

export default async function userRoutes(fastify: FastifyInstance) {
  // Get userService from DI container via fastify decorator
  const userService = fastify.diContainer.cradle.userService

  // Get all users - admin only
  fastify.get(
    '/',
    {
      onRequest: [authorizeRoles(UserRole.ADMIN)],
      schema: {
        description: 'Get all users (requires admin role)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 10 },
            search: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              users: {
                type: 'array',
                items: userSchema,
              },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        page = 1,
        limit = 10,
        search,
      } = request.query as { page?: number; limit?: number; search?: string }
      const result = await userService.getAllUsers({ page, limit, search })
      return reply.send(result)
    }
  )

  // Get user by ID - authenticated users can get their own info, admins can get any
  fastify.get(
    '/:id',
    {
      onRequest: [authenticateMiddleware],
      schema: {
        description: 'Get user by ID (requires authentication)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: userSchema,
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const currentUser = request.user!
      const { id } = request.params as { id: string }

      // Users can only get their own info unless they're admin
      if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
        return reply.code(403).send({
          error: 'You can only access your own information',
          code: 403,
        })
      }

      const user = await userService.getUserById(id)
      return reply.send(user)
    }
  )

  // Update user - users can update themselves, admins can update anyone
  fastify.put(
    '/:id',
    {
      onRequest: [authenticateMiddleware],
      schema: {
        description: 'Update user (requires authentication)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: updateUserSchema,
        response: {
          200: userSchema,
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const currentUser = request.user!
      const { id } = request.params as { id: string }
      const body = request.body as {
        name?: string
        phone?: string
        role?: string
        isActive?: boolean
      }

      // Users can only update themselves, admins can update anyone
      if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
        return reply.code(403).send({
          error: 'You can only update your own information',
          code: 403,
        })
      }

      // Non-admins cannot change roles or active status
      if (currentUser.role !== UserRole.ADMIN && (body.role || body.isActive !== undefined)) {
        return reply.code(403).send({
          error: 'Only admins can change role or active status',
          code: 403,
        })
      }

      const user = await userService.updateUser(id, body)
      return reply.send(user)
    }
  )

  // Delete user - admin only
  fastify.delete(
    '/:id',
    {
      onRequest: [authorizeRoles(UserRole.ADMIN)],
      schema: {
        description: 'Delete user (requires admin role)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const deleted = await userService.deleteUser(id)
      if (!deleted) {
        return reply.code(404).send({
          error: 'User not found',
          code: 404,
        })
      }
      return reply.send({ message: 'User deleted successfully' })
    }
  )
}
