import { FastifyInstance } from 'fastify'
import {
  getItemsResponseSchema,
  itemSchema,
  itemIdParamsSchema,
  batchDeleteResponseSchema,
  deleteItemResponseSchema,
  errorResponseSchema,
} from './item.schemas'
import {
  getItemsQuerySchema,
  createItemDtoSchema,
  updateItemDtoSchema,
  batchDeleteItemsDtoSchema,
} from './item.dto'
import { UserRole } from '@/constants'
import { authenticateMiddleware, authorizeRoles } from '@/shared/middleware/authenticate.middleware'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { NotFoundError } from '@/shared/utils/errors'

export default async function itemController(fastify: FastifyInstance) {
  // Get itemService from DI container
  const itemService = fastify.diContainer.cradle.itemService

  // Get all items - authenticated users
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      onRequest: [authenticateMiddleware],
      schema: {
        description: 'Get all items (requires authentication)',
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

  // Get item by ID - authenticated users
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
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const item = await itemService.getItemById(id)

      if (!item) {
        throw new NotFoundError('Item not found')
      }

      return reply.send(item)
    }
  )

  // Create item - moderator or admin
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      onRequest: [authorizeRoles(UserRole.MODERATOR, UserRole.ADMIN)],
      schema: {
        description: 'Create new item (requires moderator or admin role)',
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
      const user = request.user!
      const item = await itemService.createItem({
        ...request.body,
        userId: user.id,
      })

      return reply.code(201).send(item)
    }
  )

  // Update item - moderator or admin
  fastify.withTypeProvider<ZodTypeProvider>().put(
    '/:id',
    {
      onRequest: [authorizeRoles(UserRole.MODERATOR, UserRole.ADMIN)],
      schema: {
        description: 'Update item (requires moderator or admin role)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        params: itemIdParamsSchema,
        body: updateItemDtoSchema,
        response: {
          200: itemSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const item = await itemService.updateItem(id, request.body)

      if (!item) {
        throw new NotFoundError('Item not found')
      }

      return reply.send(item)
    }
  )

  // Delete item - moderator or admin
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      onRequest: [authorizeRoles(UserRole.MODERATOR, UserRole.ADMIN)],
      schema: {
        description: 'Delete item (requires moderator or admin role)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        params: itemIdParamsSchema,
        response: {
          200: deleteItemResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const deleted = await itemService.deleteItem(id)

      if (!deleted) {
        throw new NotFoundError('Item not found')
      }

      return reply.send({ message: 'Item deleted successfully' })
    }
  )

  // Batch delete items - admin only
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/batch-delete',
    {
      onRequest: [authorizeRoles(UserRole.ADMIN)],
      schema: {
        description: 'Batch delete items (requires admin role)',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        body: batchDeleteItemsDtoSchema,
        response: {
          200: batchDeleteResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { ids } = request.body
      const result = await itemService.batchDelete(ids)

      return reply.send({
        message: `Successfully deleted ${result.deletedCount} items`,
        deleted: result.deletedCount,
      })
    }
  )
}
