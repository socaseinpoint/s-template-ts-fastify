import { z } from 'zod'

/**
 * Item category enum
 */
export const itemCategorySchema = z.enum(['electronics', 'clothing', 'food', 'books', 'other'])
export type ItemCategory = z.infer<typeof itemCategorySchema>

/**
 * Item status enum
 */
export const itemStatusSchema = z.enum(['available', 'out_of_stock', 'discontinued'])
export type ItemStatus = z.infer<typeof itemStatusSchema>

/**
 * Item schema (response)
 */
export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: itemCategorySchema,
  price: z.number().min(0),
  quantity: z.number().min(0),
  status: itemStatusSchema,
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  userId: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})

export type Item = z.infer<typeof itemSchema>

/**
 * Create item DTO schema
 */
export const createItemDtoSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: itemCategorySchema,
  price: z.number().min(0),
  quantity: z.number().min(0).default(0),
  status: itemStatusSchema.default('available'),
  tags: z.array(z.string()).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateItemDto = z.infer<typeof createItemDtoSchema>

/**
 * Update item DTO schema
 */
export const updateItemDtoSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: itemCategorySchema.optional(),
  price: z.number().min(0).optional(),
  quantity: z.number().min(0).optional(),
  status: itemStatusSchema.optional(),
  tags: z.array(z.string()).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type UpdateItemDto = z.infer<typeof updateItemDtoSchema>

/**
 * Get items query parameters schema
 */
export const getItemsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  category: z.string().optional(),
})

export type GetItemsQuery = z.infer<typeof getItemsQuerySchema>

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
})

export type Pagination = z.infer<typeof paginationSchema>

/**
 * Get items response schema
 */
export const getItemsResponseSchema = z.object({
  items: z.array(itemSchema),
  pagination: paginationSchema,
})

export type GetItemsResponse = z.infer<typeof getItemsResponseSchema>

/**
 * Item ID params schema
 */
export const itemIdParamsSchema = z.object({
  id: z.string(),
})

export type ItemIdParams = z.infer<typeof itemIdParamsSchema>

/**
 * Batch delete items DTO schema
 */
export const batchDeleteItemsDtoSchema = z.object({
  ids: z.array(z.string()).min(1),
})

export type BatchDeleteItemsDto = z.infer<typeof batchDeleteItemsDtoSchema>

/**
 * Batch delete response schema
 */
export const batchDeleteResponseSchema = z.object({
  message: z.string(),
  deleted: z.number(),
})

export type BatchDeleteResponse = z.infer<typeof batchDeleteResponseSchema>

/**
 * Delete item response schema
 */
export const deleteItemResponseSchema = z.object({
  message: z.string(),
})

export type DeleteItemResponse = z.infer<typeof deleteItemResponseSchema>

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.number(),
  details: z.array(z.any()).optional(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>
