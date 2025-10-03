import { FastifyInstance } from 'fastify'
import {
  userResponseSchema,
  getUsersResponseSchema,
  userIdParamsSchema,
  deleteUserResponseSchema,
  forbiddenErrorSchema,
  notFoundErrorSchema,
} from './user.schemas'
import { updateUserDtoSchema, getUsersQuerySchema } from './user.dto'
import { UserRole } from '@/constants'
import { authorizeRoles } from '@/shared/middleware/authenticate.middleware'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { NotFoundError, ForbiddenError } from '@/shared/utils/errors'

export default async function userController(fastify: FastifyInstance) {
  // Get userService from DI container via fastify decorator
  const userService = fastify.diContainer.cradle.userService

  // Get all users - admin only
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      onRequest: [authorizeRoles(UserRole.ADMIN)],
      schema: {
        description: 'Get all users (requires admin role)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        querystring: getUsersQuerySchema,
        response: {
          200: getUsersResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await userService.getAllUsers(request.query)
      return reply.send(result)
    }
  )

  // Get user by ID - authenticated users can get their own info, admins can get any
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Get user by ID (requires authentication)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        params: userIdParamsSchema,
        response: {
          200: userResponseSchema,
          403: forbiddenErrorSchema,
          404: notFoundErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const currentUser = request.user!
      const { id } = request.params

      // Users can only get their own info unless they're admin
      if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
        throw new ForbiddenError('You can only access your own information')
      }

      const user = await userService.getUserById(id)

      if (!user) {
        throw new NotFoundError('User not found')
      }

      return reply.send(user)
    }
  )

  // Update user - users can update themselves, admins can update anyone
  fastify.withTypeProvider<ZodTypeProvider>().put(
    '/:id',
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: 'Update user (requires authentication)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        params: userIdParamsSchema,
        body: updateUserDtoSchema,
        response: {
          200: userResponseSchema,
          403: forbiddenErrorSchema,
          404: notFoundErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const currentUser = request.user!
      const { id } = request.params
      const body = request.body

      // Users can only update themselves, admins can update anyone
      if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
        throw new ForbiddenError('You can only update your own information')
      }

      // Non-admins cannot change roles or active status
      if (currentUser.role !== UserRole.ADMIN && (body.role || body.isActive !== undefined)) {
        throw new ForbiddenError('Only admins can change role or active status')
      }

      const user = await userService.updateUser(id, body)

      if (!user) {
        throw new NotFoundError('User not found')
      }

      return reply.send(user)
    }
  )

  // Delete user - admin only
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      onRequest: [authorizeRoles(UserRole.ADMIN)],
      schema: {
        description: 'Delete user (requires admin role)',
        tags: ['Users'],
        security: [{ Bearer: [] }],
        params: userIdParamsSchema,
        response: {
          200: deleteUserResponseSchema,
          404: notFoundErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const deleted = await userService.deleteUser(id)

      if (!deleted) {
        throw new NotFoundError('User not found')
      }

      return reply.send({ message: 'User deleted successfully' })
    }
  )
}
