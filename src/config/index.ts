import { z } from 'zod'

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Database configuration
  DATABASE_URL: z.string().optional(),

  // Redis configuration
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // API Keys
  API_KEY: z.string().optional(),

  // JWT Configuration - MUST be strong (64+ chars) in production
  JWT_SECRET: z
    .string()
    .min(64, 'JWT_SECRET must be at least 64 characters for security')
    .default('your-secret-key-change-this-in-production-min-64-chars-for-security'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Service specific configuration
  SERVICE_NAME: z.string().default('fastify-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Feature flags
  ENABLE_METRICS: z
    .string()
    .default('false')
    .transform(val => val === 'true'),
  ENABLE_HEALTH_CHECK: z
    .string()
    .default('true')
    .transform(val => val !== 'false'),
  ENABLE_SWAGGER: z
    .string()
    .default('true')
    .transform(val => val !== 'false'),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIMEWINDOW: z.coerce.number().int().positive().default(60000), // 1 minute in ms
  ENABLE_RATE_LIMIT: z
    .string()
    .default('true')
    .transform(val => val !== 'false'),
})

/**
 * Check if a string has sufficient entropy for cryptographic use
 * Returns true if the secret has good randomness
 */
function hasStrongEntropy(secret: string): boolean {
  if (secret.length < 64) return false
  
  const buffer = Buffer.from(secret)
  const uniqueChars = new Set(buffer).size
  const entropy = uniqueChars / buffer.length
  
  // Good entropy should have > 50% unique characters
  // and use a variety of character types
  return entropy > 0.5
}

/**
 * Validate JWT secret strength
 * Checks for common weak patterns
 */
function isWeakSecret(secret: string): boolean {
  const weakPatterns = [
    'change-this',
    'password',
    'secret',
    '123456',
    'qwerty',
    'default',
    'test',
  ]
  
  const lowerSecret = secret.toLowerCase()
  return weakPatterns.some(pattern => lowerSecret.includes(pattern))
}

// Validate environment variables
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env)

    // Additional production checks
    if (parsed.NODE_ENV === 'production') {
      // Check for weak/default secrets
      if (isWeakSecret(parsed.JWT_SECRET)) {
        throw new Error(
          '❌ SECURITY: JWT_SECRET contains weak or default patterns! Use a cryptographically secure random string.'
        )
      }
      
      // Check minimum length
      if (parsed.JWT_SECRET.length < 64) {
        throw new Error('❌ SECURITY: JWT_SECRET must be at least 64 characters in production')
      }
      
      // Check entropy
      if (!hasStrongEntropy(parsed.JWT_SECRET)) {
        throw new Error(
          '❌ SECURITY: JWT_SECRET has weak entropy! Generate a secure random secret using: openssl rand -base64 64'
        )
      }
      
      // Require database in production
      if (!parsed.DATABASE_URL) {
        throw new Error('❌ DATABASE_URL is required in production')
      }
    }

    // Warn about weak secrets in non-production
    if (parsed.NODE_ENV !== 'production') {
      if (parsed.JWT_SECRET.length < 64) {
        console.warn('⚠️  WARNING: JWT_SECRET should be at least 64 characters even in development')
      }
      if (isWeakSecret(parsed.JWT_SECRET)) {
        console.warn('⚠️  WARNING: JWT_SECRET contains weak patterns. Generate secure secret: openssl rand -base64 64')
      }
    }

    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      error.issues.forEach(issue => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
      })
      process.exit(1)
    }
    throw error
  }
}

// Simple singleton pattern - validates once on first access
let configInstance: z.infer<typeof envSchema> | null = null

/**
 * Get validated configuration
 * Validates environment variables on first call, then returns cached instance
 */
export function getConfig(): z.infer<typeof envSchema> {
  if (!configInstance) {
    configInstance = validateEnv()
  }
  return configInstance
}

/**
 * Reset configuration instance (useful for testing)
 * WARNING: Only use in test environments
 */
export function resetConfig(): void {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  resetConfig() should only be used in test environment')
  }
  configInstance = null
}

// Export Config for backward compatibility (uses getter internally)
export const Config = getConfig()

export type ConfigType = z.infer<typeof envSchema>
