import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { UserService } from '@/services/user.service'
import { userSchema, updateUserSchema } from '@/schemas/user.schemas'

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService()

  // Get all users
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get all users',
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
    async (
      request: FastifyRequest<{
        Querystring: { page?: number; limit?: number; search?: string }
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { page = 1, limit = 10, search } = request.query
        const result = await userService.getAllUsers({ page, limit, search })
        return reply.send(result)
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to fetch users',
          code: 500,
        })
      }
    }
  )

  // Get user by ID
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get user by ID',
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const user = await userService.getUserById(request.params.id)
        if (!user) {
          return reply.code(404).send({
            error: 'User not found',
            code: 404,
          })
        }
        return reply.send(user)
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to fetch user',
          code: 500,
        })
      }
    }
  )

  // Update user
  fastify.put(
    '/:id',
    {
      schema: {
        description: 'Update user',
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
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Body: typeof updateUserSchema
      }>,
      reply: FastifyReply
    ) => {
      try {
        const user = await userService.updateUser(request.params.id, request.body)
        if (!user) {
          return reply.code(404).send({
            error: 'User not found',
            code: 404,
          })
        }
        return reply.send(user)
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to update user',
          code: 500,
        })
      }
    }
  )

  // Delete user
  fastify.delete(
    '/:id',
    {
      schema: {
        description: 'Delete user',
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
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const deleted = await userService.deleteUser(request.params.id)
        if (!deleted) {
          return reply.code(404).send({
            error: 'User not found',
            code: 404,
          })
        }
        return reply.send({ message: 'User deleted successfully' })
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to delete user',
          code: 500,
        })
      }
    }
  )
}
