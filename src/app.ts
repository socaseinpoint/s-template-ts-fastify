import Fastify, { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyFormbody from '@fastify/formbody'
import fastifyRedis from '@fastify/redis'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { swaggerConfig, swaggerUiConfig } from '@/config/swagger'
import { registerRoutes } from '@/routes'
import { Logger } from '@/shared/utils/logger'
import { Config } from '@/config'
import { jwtPlugin } from '@/shared/plugins/jwt.plugin'
import { requestContextPlugin } from '@/shared/plugins/request-context.plugin'
import { createDIContainer, DIContainer } from '@/container'
import { errorHandler } from '@/shared/middleware/error-handler.middleware'
import { RATE_LIMITS, ROUTES, ServiceStatus } from '@/constants'
import { healthResponseSchema, welcomeResponseSchema } from '@/shared/schemas/system.schemas'

const logger = new Logger('App')

/**
 * Application context - NO GLOBAL STATE
 * Everything is passed through this context
 */
export interface AppContext {
  fastify: FastifyInstance
  container: Awaited<DIContainer>
}

/**
 * Create and configure Fastify app
 * Pure factory function - no side effects, no global state
 */
export async function createApp(): Promise<AppContext> {
  logger.info('Creating Fastify application...')

  const fastify = Fastify({
    requestTimeout: 30000, // 30 seconds
    connectionTimeout: 10000, // 10 seconds
    keepAliveTimeout: 5000, // 5 seconds
    logger:
      Config.NODE_ENV === 'development'
        ? {
            level: Config.LOG_LEVEL,
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
                colorize: true,
              },
            },
          }
        : {
            level: Config.LOG_LEVEL,
          },
  }).withTypeProvider<ZodTypeProvider>()

  // Set Zod as validator and serializer
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)

  // Register centralized error handler
  fastify.setErrorHandler(errorHandler)

  // Register request context plugin (correlation ID, tracing)
  await fastify.register(requestContextPlugin)

  // Register Redis (OPTIONAL in development, REQUIRED in production)
  let redisClient
  const hasRedisConfig = Config.REDIS_URL || Config.REDIS_HOST

  if (hasRedisConfig) {
    try {
      await fastify.register(fastifyRedis, {
        url: Config.REDIS_URL,
        host: Config.REDIS_HOST,
        port: Config.REDIS_PORT,
        password: Config.REDIS_PASSWORD,
        // Graceful connection handling
        lazyConnect: false,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      })
      redisClient = fastify.redis
      logger.info('✅ Redis connected successfully')
    } catch (error) {
      if (Config.NODE_ENV === 'production') {
        logger.error('❌ Redis connection failed - FATAL (production)', error)
        throw new Error(
          'Failed to connect to Redis in production. Check REDIS_URL/REDIS_HOST configuration.'
        )
      }
      logger.warn('⚠️  Redis connection failed - falling back to in-memory storage', error)
      redisClient = undefined
    }
  } else {
    if (Config.NODE_ENV === 'production') {
      throw new Error(
        '❌ PRODUCTION ERROR: Redis is required in production! ' +
          'Set REDIS_URL or REDIS_HOST in environment variables.'
      )
    }
    logger.warn('⚠️  Redis not configured - using in-memory fallbacks (development only)')
    redisClient = undefined
  }

  // Check if we need to enable queues (MODE=all)
  const enableQueues = Config.MODE === 'all'
  let redisConnection

  if (enableQueues) {
    logger.info('MODE=all detected - enabling queue services')
    // Import here to avoid loading BullMQ in MODE=api
    const { createRedisConnection } = await import('@/shared/queue/redis-connection')
    redisConnection = createRedisConnection()
  }

  // Create DI container with Redis and optional queue support
  const container = await createDIContainer({
    redis: redisClient,
    enableQueues,
    redisConnection,
  })

  // Decorate fastify with container for access in plugins/routes
  fastify.decorate('diContainer', container)

  // Security: Helmet with strict CSP (no unsafe-inline in production)
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Only allow unsafe-inline in development for Swagger UI
        styleSrc: Config.NODE_ENV === 'development' ? ["'self'", "'unsafe-inline'"] : ["'self'"],
        scriptSrc: Config.NODE_ENV === 'development' ? ["'self'", "'unsafe-inline'"] : ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: Config.NODE_ENV === 'production',
  })

  // Rate limiting - configurable via ENABLE_RATE_LIMIT env var
  if (Config.ENABLE_RATE_LIMIT) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rateLimitConfig: any = {
      max: RATE_LIMITS.GLOBAL.MAX,
      timeWindow: RATE_LIMITS.GLOBAL.TIMEWINDOW,
      ban: RATE_LIMITS.GLOBAL.BAN,
      cache: 10000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keyGenerator: (request: any) => {
        return request.ip || (request.headers['x-forwarded-for'] as string) || 'unknown'
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorResponseBuilder: (_: any, context: any) => {
        return {
          error: 'Too many requests',
          code: 429,
          message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        }
      },
    }

    // Use Redis if available, otherwise in-memory (local only)
    if (redisClient) {
      rateLimitConfig.redis = redisClient
      await fastify.register(fastifyRateLimit, rateLimitConfig)
      logger.info('✅ Rate limiting enabled (storage: Redis - distributed)')
    } else {
      await fastify.register(fastifyRateLimit, rateLimitConfig)
      logger.warn('⚠️  Rate limiting enabled (storage: In-Memory - single instance only)')
    }
  } else {
    logger.warn('⚠️  Rate limiting disabled (set ENABLE_RATE_LIMIT=true to enable)')
  }

  // Register form body parser
  await fastify.register(fastifyFormbody)

  // Register JWT plugin (with auth decorators)
  await fastify.register(jwtPlugin)

  // Register Swagger
  if (Config.ENABLE_SWAGGER) {
    await fastify.register(fastifySwagger, swaggerConfig)
    await fastify.register(fastifySwaggerUi, swaggerUiConfig)
  }

  // Proper CORS configuration - never allow credentials with wildcard origin
  const corsOrigin = getCorsOrigin()
  await fastify.register(fastifyCors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID'],
    exposedHeaders: ['X-Correlation-ID', 'X-Request-ID'],
    credentials: corsOrigin !== '*',
  })

  // Health check endpoint with live DB check
  fastify.withTypeProvider<ZodTypeProvider>().get(
    ROUTES.HEALTH,
    {
      schema: {
        description: 'Health check endpoint with database status',
        tags: ['System'],
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async (_, reply) => {
      // Perform real-time health checks
      let dbStatus = ServiceStatus.UNAVAILABLE
      let redisStatus = ServiceStatus.UNAVAILABLE
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy'

      // Check Database
      try {
        const prisma = container.cradle.prisma
        if (prisma && typeof prisma.$queryRaw === 'function') {
          await prisma.$queryRaw`SELECT 1`
          dbStatus = ServiceStatus.AVAILABLE
        }
      } catch (error) {
        logger.error('Database health check failed:', error)
      }

      // Check Redis (optional dependency)
      try {
        const redis = container.cradle.redis
        if (redis) {
          await redis.ping()
          redisStatus = ServiceStatus.AVAILABLE
        } else {
          redisStatus = ServiceStatus.NOT_CONFIGURED
        }
      } catch (error) {
        logger.warn('Redis health check failed:', error)
        redisStatus = ServiceStatus.UNAVAILABLE
      }

      // Determine overall status
      if (dbStatus === ServiceStatus.AVAILABLE) {
        if (
          redisStatus === ServiceStatus.AVAILABLE ||
          redisStatus === ServiceStatus.NOT_CONFIGURED
        ) {
          overallStatus = 'healthy'
        } else {
          // Redis failed but it's optional
          overallStatus = 'degraded'
        }
      } else {
        overallStatus = 'unhealthy'
      }

      return reply.send({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
      })
    }
  )

  // Root endpoint
  fastify.withTypeProvider<ZodTypeProvider>().get(
    ROUTES.ROOT,
    {
      schema: {
        description: 'Welcome endpoint',
        tags: ['System'],
        response: {
          200: welcomeResponseSchema,
        },
      },
    },
    async (_, reply) => {
      return reply.send({
        message: 'Welcome to Fastify Service Template',
        version: Config.SERVICE_VERSION,
        docs: ROUTES.DOCS,
        environment: Config.NODE_ENV,
      })
    }
  )

  // Register all routes
  await fastify.register(registerRoutes)

  logger.info('Fastify application created successfully')

  return { fastify, container }
}

/**
 * Get CORS origin configuration - secure by default
 */
function getCorsOrigin(): string | string[] {
  if (Config.NODE_ENV === 'production') {
    if (Config.CORS_ORIGIN === '*') {
      throw new Error(
        '❌ SECURITY: CORS_ORIGIN=* is not allowed in production! Set specific domains (e.g., https://app.example.com)'
      )
    }
    return Config.CORS_ORIGIN.split(',').map(o => o.trim())
  }

  logger.info('Development mode - CORS set to wildcard (*)')
  return '*'
}

// Type declaration for Fastify decorator
declare module 'fastify' {
  interface FastifyInstance {
    diContainer: Awaited<DIContainer>
  }
}
