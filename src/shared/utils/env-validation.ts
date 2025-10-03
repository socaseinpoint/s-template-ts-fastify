/**
 * Environment validation utilities
 * Consolidates all env-related checks in one place
 */

import { Logger } from './logger'

const logger = new Logger('EnvValidation')

export interface RedisValidationOptions {
  redisUrl?: string
  redisHost?: string
  nodeEnv: string
  context: string // e.g., "token storage", "rate limiting", "queues"
}

/**
 * Validate Redis configuration based on environment
 * Throws in production if Redis is required but not configured
 * Warns in development
 */
export function validateRedisConfig(options: RedisValidationOptions): {
  isConfigured: boolean
  isRequired: boolean
  shouldThrow: boolean
} {
  const { redisUrl, redisHost, nodeEnv, context } = options

  const isConfigured = Boolean(redisUrl || redisHost)
  const isProduction = nodeEnv === 'production'
  const isRequired = isProduction // Redis required in production
  const shouldThrow = isRequired && !isConfigured

  if (shouldThrow) {
    throw new Error(
      `❌ PRODUCTION ERROR: Redis is required for ${context} in production! ` +
        `Set REDIS_URL or REDIS_HOST in environment variables.`
    )
  }

  if (!isConfigured && !isProduction) {
    logger.warn(`⚠️  Redis not configured for ${context} - using fallback (development only)`)
  }

  if (isConfigured) {
    logger.info(`✅ Redis configured for ${context}`)
  }

  return {
    isConfigured,
    isRequired,
    shouldThrow: false,
  }
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
