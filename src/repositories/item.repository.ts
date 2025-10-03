import { PrismaClient, Item, ItemCategory, ItemStatus } from '@prisma/client'
import { BaseRepository } from './base.repository'

export interface IItemRepository {
  findById(id: string): Promise<Item | null>
  create(data: CreateItemDto): Promise<Item>
  update(id: string, data: UpdateItemDto): Promise<Item>
  delete(id: string): Promise<void>
  deleteMany(ids: string[]): Promise<number>
  findMany(params: FindManyItemsParams): Promise<{ items: Item[]; total: number }>
}

export interface CreateItemDto {
  name: string
  description?: string
  category: ItemCategory
  price: number
  quantity?: number
  status?: ItemStatus
  tags?: string[]
  metadata?: Record<string, unknown>
  userId: string
}

export interface UpdateItemDto {
  name?: string
  description?: string
  category?: ItemCategory
  price?: number
  quantity?: number
  status?: ItemStatus
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface FindManyItemsParams {
  skip?: number
  take?: number
  where?: {
    userId?: string
    category?: ItemCategory
    status?: ItemStatus
    name?: string
  }
}

export class ItemRepository
  extends BaseRepository<Item, CreateItemDto, UpdateItemDto>
  implements IItemRepository
{
  constructor(prisma: PrismaClient) {
    super(prisma, 'Item')
  }

  protected getModel() {
    return this.prisma.item
  }

  async findById(id: string): Promise<Item | null> {
    try {
      return await this.prisma.item.findUnique({
        where: { id },
        include: { user: true },
      })
    } catch (error) {
      this.logger.error(`Error finding item by id: ${id}`, error)
      throw error
    }
  }

  async create(data: CreateItemDto): Promise<Item> {
    try {
      return await this.prisma.item.create({
        data: {
          name: data.name,
          description: data.description,
          category: data.category,
          price: data.price,
          quantity: data.quantity ?? 0,
          status: data.status ?? ItemStatus.AVAILABLE,
          tags: data.tags ?? [],
          metadata: data.metadata ?? {},
          userId: data.userId,
        },
      })
    } catch (error) {
      this.logger.error(`Error creating item: ${data.name}`, error)
      throw error
    }
  }

  async deleteMany(ids: string[]): Promise<number> {
    try {
      const result = await this.prisma.item.deleteMany({
        where: { id: { in: ids } },
      })
      return result.count
    } catch (error) {
      this.logger.error(`Error deleting many items`, error)
      throw error
    }
  }

  async findMany(params: FindManyItemsParams): Promise<{ items: Item[]; total: number }> {
    try {
      const { skip = 0, take = 10, where = {} } = params

      // Build where clause with proper types
      interface WhereClause {
        userId?: string
        category?: ItemCategory
        status?: ItemStatus
        name?: {
          contains: string
          mode: 'insensitive'
        }
      }

      const whereClause: WhereClause = {}
      if (where.userId) whereClause.userId = where.userId
      if (where.category) whereClause.category = where.category
      if (where.status) whereClause.status = where.status
      if (where.name) {
        whereClause.name = {
          contains: where.name,
          mode: 'insensitive',
        }
      }

      const [items, total] = await Promise.all([
        this.prisma.item.findMany({
          where: whereClause,
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.item.count({ where: whereClause }),
      ])

      return { items, total }
    } catch (error) {
      this.logger.error('Error finding many items', error)
      throw error
    }
  }
}
