import { Logger } from '@/shared/utils/logger'
import { IItemRepository } from './item.repository'
import { Item, ItemCategory, ItemStatus } from '@prisma/client'
import {
  ItemResponseDto,
  ItemsPaginationResponse,
  GetItemsQueryDto,
  CreateItemDto,
  UpdateItemDto,
} from './item.dto'

export class ItemService {
  private logger: Logger

  constructor(private itemRepository: IItemRepository) {
    this.logger = new Logger('ItemService')
  }

  /**
   * Convert Item entity to response DTO with normalized enums
   */
  private toResponseDto(item: Item): ItemResponseDto {
    return {
      ...item,
      description: item.description ?? undefined,
      category: item.category.toLowerCase() as
        | 'electronics'
        | 'clothing'
        | 'food'
        | 'books'
        | 'other',
      status: item.status.toLowerCase() as 'available' | 'out_of_stock' | 'discontinued',
      metadata: (item.metadata as Record<string, unknown>) || undefined,
    }
  }

  async getAllItems(params: GetItemsQueryDto): Promise<ItemsPaginationResponse> {
    const { page = 1, limit = 10, search, category, status } = params

    this.logger.debug(`Fetching items with params: ${JSON.stringify(params)}`)

    // Use repository
    const { items, total } = await this.itemRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
      where: {
        category: category ? (category.toUpperCase() as ItemCategory) : undefined,
        status: status ? (status.toUpperCase() as ItemStatus) : undefined,
        name: search,
      },
    })

    const totalPages = Math.ceil(total / limit)

    return {
      items: items.map(item => this.toResponseDto(item)),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    }
  }

  async getItemById(id: string): Promise<ItemResponseDto | null> {
    this.logger.debug(`Fetching item with id: ${id}`)

    const item = await this.itemRepository.findById(id)

    if (!item) {
      return null
    }

    return this.toResponseDto(item)
  }

  async createItem(dto: CreateItemDto & { userId: string }): Promise<ItemResponseDto> {
    this.logger.info(`Creating new item: ${dto.name}`)

    const item = await this.itemRepository.create({
      name: dto.name,
      description: dto.description,
      category: dto.category.toUpperCase() as ItemCategory,
      price: dto.price,
      quantity: dto.quantity || 0,
      tags: dto.tags || [],
      metadata: dto.metadata,
      userId: dto.userId,
    })

    this.logger.info(`Item created with id: ${item.id}`)

    return this.toResponseDto(item)
  }

  async updateItem(id: string, dto: UpdateItemDto): Promise<ItemResponseDto | null> {
    this.logger.info(`Updating item with id: ${id}`)

    try {
      // Build update data with proper types for repository
      const updateData: import('./item.repository').UpdateItemData = {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        quantity: dto.quantity,
        tags: dto.tags,
        metadata: dto.metadata,
        category: dto.category ? (dto.category.toUpperCase() as ItemCategory) : undefined,
        status: dto.status ? (dto.status.toUpperCase() as ItemStatus) : undefined,
      }

      const item = await this.itemRepository.update(id, updateData)

      return this.toResponseDto(item)
    } catch (error) {
      // Type guard for Prisma errors
      if (error instanceof Error && 'code' in error) {
        const prismaError = error as { code: string }
        if (prismaError.code === 'P2025') {
          return null
        }
      }
      throw error
    }
  }

  async deleteItem(id: string): Promise<boolean> {
    this.logger.info(`Deleting item with id: ${id}`)

    try {
      await this.itemRepository.delete(id)
      return true
    } catch (error) {
      // Type guard for Prisma errors
      if (error instanceof Error && 'code' in error) {
        const prismaError = error as { code: string }
        if (prismaError.code === 'P2025') {
          return false
        }
      }
      throw error
    }
  }

  async batchDelete(ids: string[]): Promise<{ deletedCount: number }> {
    this.logger.info(`Batch deleting ${ids.length} items`)

    const count = await this.itemRepository.deleteMany(ids)

    this.logger.info(`Deleted ${count} items`)

    return { deletedCount: count }
  }
}
