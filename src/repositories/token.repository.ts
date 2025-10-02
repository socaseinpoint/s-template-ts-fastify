import { Logger } from '@/utils/logger'

export interface ITokenRepository {
  set(key: string, value: string, expiresInSeconds: number): Promise<void>
  get(key: string): Promise<string | null>
  del(key: string): Promise<void>
  addToSet(key: string, value: string): Promise<void>
  getSet(key: string): Promise<string[]>
  removeFromSet(key: string, value: string): Promise<void>
}

/**
 * Token repository for managing refresh tokens and blacklists
 * Supports multi-device sessions by storing multiple refresh tokens per user
 */
export class TokenRepository implements ITokenRepository {
  private logger: Logger
  private storage: Map<string, { value: string | Set<string>; expiresAt: number }>

  constructor() {
    this.logger = new Logger('TokenRepository')
    this.storage = new Map()

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, data] of this.storage.entries()) {
      if (data.expiresAt < now) {
        this.storage.delete(key)
      }
    }
  }

  async set(key: string, value: string, expiresInSeconds: number): Promise<void> {
    try {
      const expiresAt = Date.now() + expiresInSeconds * 1000
      this.storage.set(key, { value, expiresAt })
    } catch (error) {
      this.logger.error(`Error setting key: ${key}`, error)
      throw error
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const data = this.storage.get(key)
      if (!data) return null

      // Check if expired
      if (data.expiresAt < Date.now()) {
        this.storage.delete(key)
        return null
      }

      if (typeof data.value === 'string') {
        return data.value
      }

      return null
    } catch (error) {
      this.logger.error(`Error getting key: ${key}`, error)
      return null
    }
  }

  async del(key: string): Promise<void> {
    try {
      this.storage.delete(key)
    } catch (error) {
      this.logger.error(`Error deleting key: ${key}`, error)
      throw error
    }
  }

  async addToSet(key: string, value: string): Promise<void> {
    try {
      const data = this.storage.get(key)
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days default

      if (!data) {
        this.storage.set(key, { value: new Set([value]), expiresAt })
      } else if (data.value instanceof Set) {
        data.value.add(value)
      } else {
        // Convert string to set
        this.storage.set(key, { value: new Set([value]), expiresAt })
      }
    } catch (error) {
      this.logger.error(`Error adding to set: ${key}`, error)
      throw error
    }
  }

  async getSet(key: string): Promise<string[]> {
    try {
      const data = this.storage.get(key)
      if (!data) return []

      // Check if expired
      if (data.expiresAt < Date.now()) {
        this.storage.delete(key)
        return []
      }

      if (data.value instanceof Set) {
        return Array.from(data.value)
      }

      return []
    } catch (error) {
      this.logger.error(`Error getting set: ${key}`, error)
      return []
    }
  }

  async removeFromSet(key: string, value: string): Promise<void> {
    try {
      const data = this.storage.get(key)
      if (!data || !(data.value instanceof Set)) return

      data.value.delete(value)

      // If set is empty, remove the key
      if (data.value.size === 0) {
        this.storage.delete(key)
      }
    } catch (error) {
      this.logger.error(`Error removing from set: ${key}`, error)
      throw error
    }
  }
}
