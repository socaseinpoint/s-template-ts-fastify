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

  // JWT Configuration - MUST be strong in production
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters in production')
    .default('your-secret-key-change-this-in-production-min-32-chars'),
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
    .transform(val => val === 'true')
    .default('false'),
  ENABLE_HEALTH_CHECK: z
    .string()
    .transform(val => val !== 'false')
    .default('true'),
  ENABLE_SWAGGER: z
    .string()
    .transform(val => val !== 'false')
    .default('true'),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIMEWINDOW: z.coerce.number().int().positive().default(60000), // 1 minute in ms
})

// Validate environment variables on import
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env)

    // Additional production checks
    if (parsed.NODE_ENV === 'production') {
      if (parsed.JWT_SECRET.includes('change-this')) {
        throw new Error(
          '❌ SECURITY: JWT_SECRET must be changed in production! Never use default secrets.'
        )
      }
      if (parsed.JWT_SECRET.length < 32) {
        throw new Error('❌ SECURITY: JWT_SECRET must be at least 32 characters in production')
      }
      if (!parsed.DATABASE_URL) {
        throw new Error('❌ DATABASE_URL is required in production')
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

export const Config = validateEnv()

export type ConfigType = typeof Config
