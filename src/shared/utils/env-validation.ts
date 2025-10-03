/**
 * Environment validation utilities
 * Consolidates all env-related checks in one place
 */

import { Logger } from './logger'

const logger = new Logger('EnvValidation')

export interface RedisValidationOptions {
  redisUrl: string
  redisHost?: string
  context: string // e.g., "token storage", "rate limiting", "queues"
}

/**
 * Validate Redis configuration (REQUIRED for all environments)
 * Throws if Redis is not configured properly
 * Video service cannot function without Redis
 */
export function validateRedisConfig(options: RedisValidationOptions): void {
  const { redisUrl, redisHost, context } = options

  const isConfigured = Boolean(redisUrl || redisHost)

  if (!isConfigured) {
    throw new Error(
      `❌ Redis is REQUIRED for ${context}! ` +
        `Set REDIS_URL or REDIS_HOST in environment variables. ` +
        `For local development: REDIS_URL=redis://localhost:6379 ` +
        `Start Redis with: docker compose -f docker-compose.dev.yml up -d redis`
    )
  }

  logger.info(`✅ Redis configured for ${context}: ${redisUrl || `${redisHost}:6379`}`)
}

/**
 * Validate database configuration
 * Throws if DATABASE_URL is missing (except in unit tests)
 */
export function validateDatabaseConfig(databaseUrl?: string, nodeEnv?: string): void {
  const env = nodeEnv || process.env.NODE_ENV

  if (!databaseUrl) {
    if (env === 'test') {
      logger.warn('⚠️  Unit test mode: DATABASE_URL not provided')
      return
    }

    if (env === 'production') {
      throw new Error('❌ DATABASE_URL is required in production')
    }

    throw new Error('DATABASE_URL is required in non-test environments')
  }

  logger.info('✅ Database URL configured')
}
