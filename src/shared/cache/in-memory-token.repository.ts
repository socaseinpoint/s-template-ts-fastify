import { Logger } from '@/shared/utils/logger'
import type { ITokenRepository } from './redis-token.repository'

/**
 * In-Memory Token Repository
 *
 * WARNING: Only for local development!
 * - Tokens are lost on restart
 * - Not shared between multiple API instances
 * - No persistence
 *
 * Use Redis in production!
 */
export class InMemoryTokenRepository implements ITokenRepository {
  private logger: Logger
  private store = new Map<string, { value: string; expiresAt: number }>()
  private sets = new Map<string, Set<string>>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.logger = new Logger('InMemoryTokenRepository')
    this.logger.warn('⚠️  Using IN-MEMORY token storage - NOT FOR PRODUCTION!')
    this.logger.warn('⚠️  Tokens will be lost on restart')
    this.logger.warn('⚠️  Use Redis for production: set REDIS_URL in .env')

    // Cleanup expired tokens every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpired()
      },
      5 * 60 * 1000
    )
  }

  async set(key: string, value: string, expiresInSeconds: number): Promise<void> {
    const expiresAt = Date.now() + expiresInSeconds * 1000
    this.store.set(key, { value, expiresAt })
  }

  async get(key: string): Promise<string | null> {
    const data = this.store.get(key)
    if (!data) {
      return null
    }

    // Check if expired
    if (Date.now() > data.expiresAt) {
      this.store.delete(key)
      return null
    }

    return data.value
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async addToSet(key: string, value: string, _expiresInSeconds?: number): Promise<void> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set())
    }
    const set = this.sets.get(key)
    if (set) {
      set.add(value)
    }
  }

  async getSet(key: string): Promise<string[]> {
    const set = this.sets.get(key)
    return set ? Array.from(set) : []
  }

  async removeFromSet(key: string, value: string): Promise<void> {
    const set = this.sets.get(key)
    if (set) {
      set.delete(value)
    }
  }

  async cleanupExpiredTokens(_userId: string): Promise<void> {
    // In-memory repository doesn't need manual cleanup
    // Tokens are automatically cleaned by cleanupExpired() interval
  }

  /**
   * Cleanup expired tokens to prevent memory leaks
   */
  private cleanupExpired(): void {
    const now = Date.now()

    for (const [key, data] of this.store.entries()) {
      if (now > data.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Dispose - cleanup interval
   * Call this before shutdown
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
    this.sets.clear()
    this.logger.info('In-memory token repository disposed')
  }
}
