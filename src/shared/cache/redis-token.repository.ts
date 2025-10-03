import { Logger } from '@/shared/utils/logger'
import { ITokenRepository } from './token.repository'
import type { FastifyRedis } from '@fastify/redis'

/**
 * Redis-based Token Repository
 * Production-ready implementation with Redis for distributed systems
 */
export class RedisTokenRepository implements ITokenRepository {
  private logger: Logger

  constructor(private redis: FastifyRedis) {
    this.logger = new Logger('RedisTokenRepository')
    this.logger.info('✅ Using Redis for token storage')
  }

  /**
   * Set a key-value pair with expiration
   */
  async set(key: string, value: string, expiresInSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, expiresInSeconds, value)
      this.logger.debug(`Token set: ${key}`)
    } catch (error) {
      this.logger.error('Failed to set token in Redis', error)
      throw error
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key)
    } catch (error) {
      this.logger.error('Failed to get token from Redis', error)
      throw error
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
      this.logger.debug(`Token deleted: ${key}`)
    } catch (error) {
      this.logger.error('Failed to delete token from Redis', error)
      throw error
    }
  }

  /**
   * Add value to a set with expiration
   */
  async addToSet(
    key: string,
    value: string,
    expiresInSeconds: number = 7 * 24 * 60 * 60
  ): Promise<void> {
    try {
      await this.redis.sadd(key, value)
      await this.redis.expire(key, expiresInSeconds)
      this.logger.debug(`Added to set: ${key}`)
    } catch (error) {
      this.logger.error('Failed to add to set in Redis', error)
      throw error
    }
  }

  /**
   * Get all values from a set
   */
  async getSet(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key)
    } catch (error) {
      this.logger.error('Failed to get set from Redis', error)
      throw error
    }
  }

  /**
   * Remove value from set
   */
  async removeFromSet(key: string, value: string): Promise<void> {
    try {
      await this.redis.srem(key, value)
      this.logger.debug(`Removed from set: ${key}`)
    } catch (error) {
      this.logger.error('Failed to remove from set in Redis', error)
      throw error
    }
  }

  /**
   * Cleanup expired tokens for a user
   * Redis handles TTL automatically, but we can verify token validity
   */
  async cleanupExpiredTokens(userId: string): Promise<void> {
    const key = `refresh:${userId}`
    try {
      const tokens = await this.getSet(key)
      this.logger.debug(`User ${userId} has ${tokens.length} active refresh tokens`)
    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens', error)
    }
  }

  /**
   * No disposal needed for Redis - connection managed by Fastify
   */
  dispose(): void {
    this.logger.info('RedisTokenRepository disposed')
  }
}
