import { z } from 'zod'
import { itemCategorySchema, itemStatusSchema } from './item.schemas'

// ============================================
// Response DTOs
// ============================================

export interface ItemResponseDto {
  id: string
  name: string
  description?: string
  category: 'electronics' | 'clothing' | 'food' | 'books' | 'other'
  price: number
  quantity: number
  status: 'available' | 'out_of_stock' | 'discontinued'
  tags: string[]
  metadata?: Record<string, unknown>
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface ItemsPaginationResponse {
  items: ItemResponseDto[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ============================================
// Request DTOs
// ============================================

export const createItemDtoSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: itemCategorySchema,
  price: z.number().min(0),
  quantity: z.number().min(0).default(0),
  tags: z.array(z.string()).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateItemDto = z.infer<typeof createItemDtoSchema>

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

// ============================================
// Query DTOs
// ============================================

export const getItemsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
})

export type GetItemsQueryDto = z.infer<typeof getItemsQuerySchema>

// ============================================
// Other DTOs
// ============================================

export const batchDeleteItemsDtoSchema = z.object({
  ids: z.array(z.string()).min(1),
})

export type BatchDeleteItemsDto = z.infer<typeof batchDeleteItemsDtoSchema>
