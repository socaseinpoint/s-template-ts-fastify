import Fastify, { FastifyInstance } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyFormbody from '@fastify/formbody'
import fastifyRedis from '@fastify/redis'
import { swaggerConfig, swaggerUiConfig } from '@/config/swagger'
import { registerRoutes } from '@/routes'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'
import { jwtPlugin } from '@/plugins/jwt.plugin'
import { requestContextPlugin } from '@/plugins/request-context.plugin'
import { createDIContainer, DIContainer } from '@/container'
import { errorHandler } from '@/middleware/error-handler.middleware'
import { RATE_LIMITS, ROUTES, ServiceStatus } from '@/constants'

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
  })

  // Register centralized error handler
  fastify.setErrorHandler(errorHandler)

  // Register request context plugin (correlation ID, tracing)
  await fastify.register(requestContextPlugin)

  // Register Redis (optional - graceful fallback to in-memory)
  let redisClient
  if (Config.REDIS_URL || Config.REDIS_HOST) {
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
      logger.warn('⚠️  Redis connection failed, falling back to in-memory storage', error)
      redisClient = undefined
    }
  } else {
    logger.info('ℹ️  Redis not configured, using in-memory token storage')
  }

  // Create DI container with Redis if available
  const container = await createDIContainer({ redis: redisClient })

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

  // Rate limiting - disabled in test environment
  if (Config.NODE_ENV !== 'test') {
    await fastify.register(fastifyRateLimit, {
      max: RATE_LIMITS.GLOBAL.MAX,
      timeWindow: RATE_LIMITS.GLOBAL.TIMEWINDOW,
      ban: RATE_LIMITS.GLOBAL.BAN,
      cache: 10000,
    })
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
  fastify.get(
    ROUTES.HEALTH,
    {
      schema: {
        description: 'Health check endpoint with database status',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['healthy', 'unhealthy'] },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              database: { type: 'string' },
            },
          },
        },
      },
    },
    async (_, reply) => {
      // Perform real-time database health check
      let dbStatus = ServiceStatus.UNAVAILABLE
      let overallStatus = ServiceStatus.UNAVAILABLE

      try {
        const prisma = container.cradle.prisma
        if (prisma && typeof prisma.$queryRaw === 'function') {
          await prisma.$queryRaw`SELECT 1`
          dbStatus = ServiceStatus.AVAILABLE
          overallStatus = ServiceStatus.AVAILABLE
        }
      } catch (error) {
        logger.error('Health check failed:', error)
      }

      return reply.send({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
      })
    }
  )

  // Root endpoint
  fastify.get(
    ROUTES.ROOT,
    {
      schema: {
        description: 'Welcome endpoint',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              version: { type: 'string' },
              docs: { type: 'string' },
              environment: { type: 'string' },
            },
          },
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
function getCorsOrigin(): string | string[] | boolean {
  if (Config.NODE_ENV === 'production') {
    if (Config.CORS_ORIGIN === '*') {
      logger.warn('⚠️  CORS wildcard (*) in production - credentials disabled for security')
      return '*'
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
