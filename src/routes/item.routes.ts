import { FastifyInstance } from 'fastify'
import {
  itemSchema,
  getItemsResponseSchema,
  itemIdParamsSchema,
  batchDeleteResponseSchema,
  deleteItemResponseSchema,
  errorResponseSchema,
} from '@/schemas/item.schemas'
import {
  createItemDtoSchema,
  updateItemDtoSchema,
  getItemsQuerySchema,
  batchDeleteItemsDtoSchema,
} from '@/dto/item.dto'
import { UserRole } from '@/constants'
import { authenticateMiddleware, authorizeRoles } from '@/middleware/authenticate.middleware'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { NotFoundError, UnauthorizedError } from '@/utils/errors'

// Error response schemas
const notFoundErrorSchema = errorResponseSchema

export default async function itemRoutes(fastify: FastifyInstance) {
  // Get itemService from DI container via fastify decorator
  const itemService = fastify.diContainer.cradle.itemService

  // Get all items - accessible by all authenticated users
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      onRequest: [authenticateMiddleware],
      schema: {
        description: 'Get all items with pagination and filtering (requires authentication)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        querystring: getItemsQuerySchema,
        response: {
          200: getItemsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await itemService.getAllItems(request.query)
      return reply.send(result)
    }
  )

  // Get item by ID - accessible by all authenticated users
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      onRequest: [authenticateMiddleware],
      schema: {
        description: 'Get item by ID (requires authentication)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        params: itemIdParamsSchema,
        response: {
          200: itemSchema,
          404: notFoundErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const item = await itemService.getItemById(request.params.id)

      if (!item) {
        throw new NotFoundError('Item not found')
      }

      return reply.send(item)
    }
  )

  // Create item - accessible by moderators and admins
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      onRequest: [authorizeRoles(UserRole.MODERATOR, UserRole.ADMIN)],
      schema: {
        description: 'Create a new item (requires moderator or admin role)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        body: createItemDtoSchema,
        response: {
          201: itemSchema,
        },
      },
    },
    async (request, reply) => {
      const user = request.user
      if (!user) {
        throw new UnauthorizedError('Unauthorized')
      }

      const item = await itemService.createItem({
        ...request.body,
        userId: user.id,
      })

      return reply.code(201).send(item)
    }
  )

  // Update item - accessible by moderators and admins
  fastify.withTypeProvider<ZodTypeProvider>().put(
    '/:id',
    {
      onRequest: [authorizeRoles(UserRole.MODERATOR, UserRole.ADMIN)],
      schema: {
        description: 'Update an existing item (requires moderator or admin role)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        params: itemIdParamsSchema,
        body: updateItemDtoSchema,
        response: {
          200: itemSchema,
          404: notFoundErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const item = await itemService.updateItem(request.params.id, request.body)

      if (!item) {
        throw new NotFoundError('Item not found')
      }

      return reply.send(item)
    }
  )

  // Delete item - accessible by admins only
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      onRequest: [authorizeRoles(UserRole.ADMIN)],
      schema: {
        description: 'Delete an item (requires admin role)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        params: itemIdParamsSchema,
        response: {
          200: deleteItemResponseSchema,
          404: notFoundErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const deleted = await itemService.deleteItem(request.params.id)

      if (!deleted) {
        throw new NotFoundError('Item not found')
      }

      return reply.send({ message: 'Item deleted successfully' })
    }
  )

  // Batch delete items - accessible by admins only
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/batch-delete',
    {
      onRequest: [authorizeRoles(UserRole.ADMIN)],
      schema: {
        description: 'Delete multiple items (requires admin role)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        body: batchDeleteItemsDtoSchema,
        response: {
          200: batchDeleteResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await itemService.batchDelete(request.body.ids)
      return reply.send({
        message: `Successfully deleted ${result.deletedCount} items`,
        deleted: result.deletedCount,
      })
    }
  )
}
