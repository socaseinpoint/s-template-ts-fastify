import { PrismaClient } from '@prisma/client'
import { Logger } from '@/utils/logger'

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
   */
  protected abstract getModel(): any

  /**
   * Find by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      return await this.getModel().findUnique({ where: { id } })
    } catch (error) {
      this.logger.error(`Failed to find ${this.modelName} by ID: ${id}`, error)
      throw error
    }
  }

  /**
   * Find many with filters
   */
  async findMany(filters: Record<string, any> = {}, options: {
    skip?: number
    take?: number
    orderBy?: Record<string, 'asc' | 'desc'>
  } = {}): Promise<T[]> {
    try {
      return await this.getModel().findMany({
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
   * Count records
   */
  async count(filters: Record<string, any> = {}): Promise<number> {
    try {
      return await this.getModel().count({ where: filters })
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
      const created = await this.getModel().create({ data })
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
      const updated = await this.getModel().update({
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
      await this.getModel().delete({ where: { id } })
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
      const count = await this.getModel().count({ where: { id } })
      return count > 0
    } catch (error) {
      this.logger.error(`Failed to check if ${this.modelName} exists: ${id}`, error)
      throw error
    }
  }
}

