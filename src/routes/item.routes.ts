import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ItemService } from '@/services/item.service'
import { itemSchema, createItemSchema, updateItemSchema } from '@/schemas/item.schemas'

export default async function itemRoutes(fastify: FastifyInstance) {
  const itemService = new ItemService()

  // Get all items
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get all items with pagination and filtering',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', default: 1, minimum: 1 },
            limit: { type: 'number', default: 10, minimum: 1, maximum: 100 },
            sortBy: {
              type: 'string',
              enum: ['name', 'createdAt', 'updatedAt'],
              default: 'createdAt',
            },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            search: { type: 'string' },
            category: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: itemSchema,
              },
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          page?: number
          limit?: number
          sortBy?: string
          sortOrder?: 'asc' | 'desc'
          search?: string
          category?: string
        }
      }>,
      reply: FastifyReply
    ) => {
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

  // Get item by ID
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get item by ID',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: itemSchema,
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

  // Create item
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new item',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        body: createItemSchema,
        response: {
          201: itemSchema,
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: typeof createItemSchema }>, reply: FastifyReply) => {
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

  // Update item
  fastify.put(
    '/:id',
    {
      schema: {
        description: 'Update an existing item',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: updateItemSchema,
        response: {
          200: itemSchema,
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
        Body: typeof updateItemSchema
      }>,
      reply: FastifyReply
    ) => {
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

  // Delete item
  fastify.delete(
    '/:id',
    {
      schema: {
        description: 'Delete an item',
        tags: ['Items'],
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

  // Batch delete items
  fastify.post(
    '/batch-delete',
    {
      schema: {
        description: 'Delete multiple items',
        tags: ['Items'],
        security: [{ Bearer: [] }],
        body: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
          },
          required: ['ids'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              deleted: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { ids: string[] } }>, reply: FastifyReply) => {
      try {
        const deletedCount = await itemService.batchDelete(request.body.ids)
        return reply.send({
          message: `Successfully deleted ${deletedCount} items`,
          deleted: deletedCount,
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
