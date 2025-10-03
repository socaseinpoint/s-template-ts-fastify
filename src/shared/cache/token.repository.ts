import { Logger } from '@/shared/utils/logger'

export interface ITokenRepository {
  set(key: string, value: string, expiresInSeconds: number): Promise<void>
  get(key: string): Promise<string | null>
  del(key: string): Promise<void>
  addToSet(key: string, value: string, expiresInSeconds?: number): Promise<void>
  getSet(key: string): Promise<string[]>
  removeFromSet(key: string, value: string): Promise<void>
  cleanupExpiredTokens(userId: string): Promise<void>
}

/**
 * Token repository for managing refresh tokens and blacklists
 * Uses in-memory storage with TTL and automatic cleanup
 * Can be extended to use Redis by implementing ITokenRepository
 */
export class TokenRepository implements ITokenRepository {
  private logger: Logger
  private storage: Map<string, { value: string | Set<string>; expiresAt: number }>
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    this.logger = new Logger('TokenRepository')
    this.storage = new Map()

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupStorage(), 5 * 60 * 1000)
  }

  /**
   * Set a key-value pair with expiration
   */
  async set(key: string, value: string, expiresInSeconds: number): Promise<void> {
    const expiresAt = Date.now() + expiresInSeconds * 1000
    this.storage.set(key, { value, expiresAt })
    this.logger.debug(`Token set: ${key}`)
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
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
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    this.storage.delete(key)
    this.logger.debug(`Token deleted: ${key}`)
  }

  /**
   * Add value to a set with expiration
   * SECURITY: Does NOT extend TTL for existing sets to prevent token lifetime extension
   */
  async addToSet(
    key: string,
    value: string,
    expiresInSeconds: number = 7 * 24 * 60 * 60
  ): Promise<void> {
    const expiresAt = Date.now() + expiresInSeconds * 1000
    const data = this.storage.get(key)

    if (!data) {
      this.storage.set(key, { value: new Set([value]), expiresAt })
    } else if (data.value instanceof Set) {
      data.value.add(value)
      // SECURITY FIX: Do NOT update expiresAt for existing sets
      // This prevents extending token lifetime with new logins
    } else {
      // Replace non-Set value with Set
      this.storage.set(key, { value: new Set([value]), expiresAt })
    }

    this.logger.debug(`Added to set: ${key}`)
  }

  /**
   * Get all values from a set
   */
  async getSet(key: string): Promise<string[]> {
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
  }

  /**
   * Remove value from set
   */
  async removeFromSet(key: string, value: string): Promise<void> {
    const data = this.storage.get(key)
    if (!data || !(data.value instanceof Set)) return

    data.value.delete(value)

    // If set is empty, remove the key
    if (data.value.size === 0) {
      this.storage.delete(key)
    }

    this.logger.debug(`Removed from set: ${key}`)
  }

  /**
   * Cleanup expired tokens for a user
   */
  async cleanupExpiredTokens(userId: string): Promise<void> {
    const key = `refresh:${userId}`
    const tokens = await this.getSet(key)

    // Tokens are automatically cleaned up by TTL
    // This method is for compatibility with the interface
    this.logger.debug(`Cleanup: ${tokens.length} active tokens for user ${userId}`)
  }

  /**
   * Cleanup expired entries from storage
   */
  private cleanupStorage(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, data] of this.storage.entries()) {
      if (data.expiresAt < now) {
        this.storage.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} expired tokens`)
    }
  }

  /**
   * Dispose cleanup interval
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}
