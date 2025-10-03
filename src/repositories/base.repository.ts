import { PrismaClient } from '@prisma/client'
import { Logger } from '@/utils/logger'

/**
 * Prisma Model Delegate type
 * Represents any Prisma model with common CRUD operations
 */
export interface PrismaModelDelegate<T> {
  findUnique(args: { where: { id: string } }): Promise<T | null>
  findMany(args?: {
    where?: Record<string, unknown>
    skip?: number
    take?: number
    orderBy?: Record<string, 'asc' | 'desc'>
    include?: Record<string, boolean>
  }): Promise<T[]>
  count(args?: { where?: Record<string, unknown> }): Promise<number>
  create(args: { data: unknown }): Promise<T>
  update(args: { where: { id: string }; data: unknown }): Promise<T>
  delete(args: { where: { id: string } }): Promise<T>
}

/**
 * Pagination response interface
 */
export interface PaginationResponse<T> {
  items: T[]
  total: number
}

/**
 * Generic Repository Pattern
 * Base class for all repositories to reduce code duplication
 */
export abstract class BaseRepository<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
  protected logger: Logger

  constructor(
    protected prisma: PrismaClient,
    private modelName: string
  ) {
    this.logger = new Logger(`${modelName}Repository`)
  }

  /**
   * Get Prisma model delegate
   * Each repository must implement this to return the correct model
   * Note: Typed as unknown due to Prisma's complex delegate types
   */
  protected abstract getModel(): unknown

  /**
   * Find by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      return await model.findUnique({ where: { id } })
    } catch (error) {
      this.logger.error(`Failed to find ${this.modelName} by ID: ${id}`, error)
      throw error
    }
  }

  /**
   * Find many with filters (simple version without pagination)
   */
  async findMany(
    filters: Record<string, unknown> = {},
    options: {
      skip?: number
      take?: number
      orderBy?: Record<string, 'asc' | 'desc'>
    } = {}
  ): Promise<T[]> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      return await model.findMany({
        where: filters,
        skip: options.skip,
        take: options.take,
        orderBy: options.orderBy,
      })
    } catch (error) {
      this.logger.error(`Failed to find many ${this.modelName}`, error)
      throw error
    }
  }

  /**
   * Find many with pagination metadata
   * Returns items and total count
   */
  async findManyWithPagination(
    filters: Record<string, unknown> = {},
    options: {
      skip?: number
      take?: number
      orderBy?: Record<string, 'asc' | 'desc'>
    } = {}
  ): Promise<PaginationResponse<T>> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      const [items, total] = await Promise.all([
        model.findMany({
          where: filters,
          skip: options.skip,
          take: options.take,
          orderBy: options.orderBy,
        }),
        this.count(filters),
      ])

      return { items, total }
    } catch (error) {
      this.logger.error(`Failed to find many ${this.modelName} with pagination`, error)
      throw error
    }
  }

  /**
   * Count records
   */
  async count(filters: Record<string, unknown> = {}): Promise<number> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      return await model.count({ where: filters })
    } catch (error) {
      this.logger.error(`Failed to count ${this.modelName}`, error)
      throw error
    }
  }

  /**
   * Create new record
   */
  async create(data: CreateDTO): Promise<T> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      const created = await model.create({ data })
      this.logger.info(`${this.modelName} created successfully`)
      return created
    } catch (error) {
      this.logger.error(`Failed to create ${this.modelName}`, error)
      throw error
    }
  }

  /**
   * Update record
   */
  async update(id: string, data: UpdateDTO): Promise<T> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      const updated = await model.update({
        where: { id },
        data,
      })
      this.logger.info(`${this.modelName} ${id} updated successfully`)
      return updated
    } catch (error) {
      this.logger.error(`Failed to update ${this.modelName} ${id}`, error)
      throw error
    }
  }

  /**
   * Delete record
   */
  async delete(id: string): Promise<void> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      await model.delete({ where: { id } })
      this.logger.info(`${this.modelName} ${id} deleted successfully`)
    } catch (error) {
      this.logger.error(`Failed to delete ${this.modelName} ${id}`, error)
      throw error
    }
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const model = this.getModel() as PrismaModelDelegate<T>
      const count = await model.count({ where: { id } })
      return count > 0
    } catch (error) {
      this.logger.error(`Failed to check if ${this.modelName} exists: ${id}`, error)
      throw error
    }
  }
}
