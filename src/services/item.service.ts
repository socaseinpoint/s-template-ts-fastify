import { Logger } from '@/utils/logger'

interface Item {
  id: string
  name: string
  description?: string
  category: 'electronics' | 'clothing' | 'food' | 'books' | 'other'
  price: number
  quantity: number
  status: 'available' | 'out_of_stock' | 'discontinued'
  tags?: string[]
  metadata?: Record<string, any>
  userId: string
  createdAt: string
  updatedAt: string
}

interface GetItemsParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  category?: string
}

interface CreateItemDto {
  name: string
  description?: string
  category: Item['category']
  price: number
  quantity?: number
  status?: Item['status']
  tags?: string[]
  metadata?: Record<string, any>
  userId: string
}

interface UpdateItemDto {
  name?: string
  description?: string
  category?: Item['category']
  price?: number
  quantity?: number
  status?: Item['status']
  tags?: string[]
  metadata?: Record<string, any>
}

export class ItemService {
  private logger: Logger
  private items: Map<string, Item>

  constructor() {
    this.logger = new Logger('ItemService')
    this.items = new Map()
    this.initMockData()
  }

  private initMockData(): void {
    const mockItems: Item[] = [
      {
        id: '1',
        name: 'Laptop Pro',
        description: 'High-performance laptop for professionals',
        category: 'electronics',
        price: 1299.99,
        quantity: 10,
        status: 'available',
        tags: ['computer', 'professional', 'portable'],
        userId: '1',
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Winter Jacket',
        description: 'Warm jacket for cold weather',
        category: 'clothing',
        price: 89.99,
        quantity: 25,
        status: 'available',
        tags: ['winter', 'warm', 'outdoor'],
        userId: '2',
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        name: 'TypeScript Handbook',
        description: 'Complete guide to TypeScript programming',
        category: 'books',
        price: 39.99,
        quantity: 0,
        status: 'out_of_stock',
        tags: ['programming', 'typescript', 'education'],
        userId: '1',
        createdAt: new Date('2024-02-01').toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    mockItems.forEach(item => this.items.set(item.id, item))
  }

  async getAllItems(params: GetItemsParams): Promise<{
    items: Item[]
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
    } = params

    this.logger.debug(`Fetching items with params: ${JSON.stringify(params)}`)

    let items = Array.from(this.items.values())

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase()
      items = items.filter(
        item =>
          item.name.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower)
      )
    }

    if (category) {
      items = items.filter(item => item.category === category)
    }

    // Apply sorting
    items.sort((a, b) => {
      const aVal = a[sortBy as keyof Item] as any
      const bVal = b[sortBy as keyof Item] as any

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    // Apply pagination
    const total = items.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const paginatedItems = items.slice(start, start + limit)

    return {
      items: paginatedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    }
  }

  async getItemById(id: string): Promise<Item | null> {
    this.logger.debug(`Fetching item with id: ${id}`)
    return this.items.get(id) || null
  }

  async createItem(dto: CreateItemDto): Promise<Item> {
    const item: Item = {
      ...dto,
      id: Math.random().toString(36).substring(7),
      status: dto.status || 'available',
      quantity: dto.quantity || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.items.set(item.id, item)
    this.logger.info(`Created item with id: ${item.id}`)
    return item
  }

  async updateItem(id: string, dto: UpdateItemDto): Promise<Item | null> {
    this.logger.info(`Updating item with id: ${id}`)

    const item = this.items.get(id)
    if (!item) {
      return null
    }

    const updatedItem: Item = {
      ...item,
      ...dto,
      updatedAt: new Date().toISOString(),
    }

    this.items.set(id, updatedItem)
    return updatedItem
  }

  async deleteItem(id: string): Promise<boolean> {
    this.logger.info(`Deleting item with id: ${id}`)
    return this.items.delete(id)
  }

  async batchDelete(ids: string[]): Promise<number> {
    this.logger.info(`Batch deleting ${ids.length} items`)

    let deletedCount = 0
    for (const id of ids) {
      if (this.items.delete(id)) {
        deletedCount++
      }
    }

    return deletedCount
  }
}
