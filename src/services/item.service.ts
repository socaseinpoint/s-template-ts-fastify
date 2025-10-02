import { Logger } from '@/utils/logger'
import { AppError } from '@/utils/errors'
import prisma from '@/services/prisma.service'
import { ItemCategory, ItemStatus } from '@prisma/client'

interface GetItemsParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  category?: string
  status?: string
}

interface CreateItemDto {
  name: string
  description?: string
  category: string
  price: number
  quantity?: number
  tags?: string[]
  metadata?: Record<string, any>
  userId: string
}

interface UpdateItemDto {
  name?: string
  description?: string
  category?: string
  price?: number
  quantity?: number
  status?: string
  tags?: string[]
  metadata?: Record<string, any>
}

export class ItemService {
  private logger: Logger

  constructor() {
    this.logger = new Logger('ItemService')
  }

  async getAllItems(params: GetItemsParams): Promise<{
    items: any[]
    pagination: {
      total: number
      page: number
      limit: number
      totalPages: number
    }
  }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      category,
      status,
    } = params

    this.logger.debug(`Fetching items with params: ${JSON.stringify(params)}`)

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.category = category.toUpperCase() as ItemCategory
    }

    if (status) {
      where.status = status.toUpperCase() as ItemStatus
    }

    // Get total count
    const total = await prisma.item.count({ where })

    // Get paginated items
    const items = await prisma.item.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        quantity: true,
        status: true,
        tags: true,
        metadata: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const totalPages = Math.ceil(total / limit)

    return {
      items: items.map(item => ({
        ...item,
        category: item.category.toLowerCase(),
        status: item.status.toLowerCase(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    }
  }

  async getItemById(id: string): Promise<any | null> {
    this.logger.debug(`Fetching item with id: ${id}`)

    const item = await prisma.item.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        price: true,
        quantity: true,
        status: true,
        tags: true,
        metadata: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!item) {
      return null
    }

    return {
      ...item,
      category: item.category.toLowerCase(),
      status: item.status.toLowerCase(),
    }
  }

  async createItem(dto: CreateItemDto): Promise<any> {
    this.logger.info(`Creating new item: ${dto.name}`)

    const item = await prisma.item.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category.toUpperCase() as ItemCategory,
        price: dto.price,
        quantity: dto.quantity || 0,
        tags: dto.tags || [],
        metadata: dto.metadata,
        userId: dto.userId,
      },
    })

    this.logger.info(`Item created with id: ${item.id}`)

    return {
      ...item,
      category: item.category.toLowerCase(),
      status: item.status.toLowerCase(),
    }
  }

  async updateItem(id: string, dto: UpdateItemDto): Promise<any | null> {
    this.logger.info(`Updating item with id: ${id}`)

    try {
      const updateData: any = { ...dto }
      
      if (dto.category) {
        updateData.category = dto.category.toUpperCase() as ItemCategory
      }
      
      if (dto.status) {
        updateData.status = dto.status.toUpperCase() as ItemStatus
      }

      const item = await prisma.item.update({
        where: { id },
        data: updateData,
      })

      return {
        ...item,
        category: item.category.toLowerCase(),
        status: item.status.toLowerCase(),
      }
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  async deleteItem(id: string): Promise<boolean> {
    this.logger.info(`Deleting item with id: ${id}`)

    try {
      await prisma.item.delete({
        where: { id },
      })
      return true
    } catch (error: any) {
      if (error.code === 'P2025') {
        return false
      }
      throw error
    }
  }

  async batchDelete(ids: string[]): Promise<{ deletedCount: number }> {
    this.logger.info(`Batch deleting ${ids.length} items`)

    const result = await prisma.item.deleteMany({
      where: {
        id: { in: ids },
      },
    })

    this.logger.info(`Deleted ${result.count} items`)

    return { deletedCount: result.count }
  }
}
