import { FastifyInstance } from 'fastify'
import {
  itemSchema,
  createItemDtoSchema,
  updateItemDtoSchema,
  getItemsQuerySchema,
  getItemsResponseSchema,
  itemIdParamsSchema,
  batchDeleteItemsDtoSchema,
  batchDeleteResponseSchema,
  deleteItemResponseSchema,
  errorResponseSchema,
} from '@/schemas/item.schemas'
import { UserRole } from '@/constants'
import { authenticateMiddleware, authorizeRoles } from '@/middleware/authenticate.middleware'
import { ZodTypeProvider } from 'fastify-type-provider-zod'

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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await itemService.getAllItems(request.query)
        return reply.send(result)
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to fetch items',
          code: 500,
        })
      }
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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const item = await itemService.getItemById(request.params.id)
        if (!item) {
          return reply.code(404).send({
            error: 'Item not found',
            code: 404,
          })
        }
        return reply.send(item)
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to fetch item',
          code: 500,
        })
      }
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
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const user = (request as any).user
        const item = await itemService.createItem({
          ...request.body,
          userId: user.id,
        })
        return reply.code(201).send(item)
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : 'Failed to create item',
          code: 400,
        })
      }
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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const item = await itemService.updateItem(request.params.id, request.body)
        if (!item) {
          return reply.code(404).send({
            error: 'Item not found',
            code: 404,
          })
        }
        return reply.send(item)
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to update item',
          code: 500,
        })
      }
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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const deleted = await itemService.deleteItem(request.params.id)
        if (!deleted) {
          return reply.code(404).send({
            error: 'Item not found',
            code: 404,
          })
        }
        return reply.send({ message: 'Item deleted successfully' })
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to delete item',
          code: 500,
        })
      }
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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await itemService.batchDelete(request.body.ids)
        return reply.send({
          message: `Successfully deleted ${result.deletedCount} items`,
          deleted: result.deletedCount,
        })
      } catch (error) {
        return reply.code(500).send({
          error: error instanceof Error ? error.message : 'Failed to delete items',
          code: 500,
        })
      }
    }
  )
}
