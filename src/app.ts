import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyRedis from '@fastify/redis'
// @ts-ignore
import fastifyFormbody from '@fastify/formbody'
import { swaggerConfig, swaggerUiConfig } from '@/config/swagger'
import { registerRoutes } from '@/routes'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'
import { DatabaseService } from '@/services/database.service'
import { RedisService } from '@/services/redis.service'
import { jwtPlugin } from '@/plugins/jwt.plugin'
import { createDIContainer, DIContainer } from '@/container'

const logger = new Logger('App')

// Service availability flags
export let isRedisAvailable = false
export let isPostgresAvailable = false

// DI Container
export let container: DIContainer

/**
 * Create and configure Fastify app
 */
export async function createApp(): Promise<FastifyInstance> {
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

  // Create DI container
  container = createDIContainer()

  // Register container with Fastify
  container.register({
    fastify: () => fastify,
  })

  // Initialize services
  await initializeServices()

  // Security: Helmet
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: Config.NODE_ENV === 'production',
  })

  // Rate limiting - critical for auth endpoints (disabled in test environment)
  if (Config.NODE_ENV !== 'test') {
    await fastify.register(fastifyRateLimit, {
      max: Config.RATE_LIMIT_MAX,
      timeWindow: Config.RATE_LIMIT_TIMEWINDOW,
      ban: 5, // Ban after 5 violations
      cache: 10000, // Cache 10k entries
    })
  }

  // Register form body parser
  fastify.register(fastifyFormbody)

  // Register JWT plugin
  fastify.register(jwtPlugin)

  // Register Swagger
  fastify.register(fastifySwagger, swaggerConfig)
  fastify.register(fastifySwaggerUi, swaggerUiConfig)

  // Configure CORS
  const getCorsOrigin = () => {
    if (Config.NODE_ENV === 'production') {
      return Config.CORS_ORIGIN || '*'
    }
    return '*'
  }

  // Enable CORS
  fastify.register(fastifyCors, {
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  // Global auth middleware for protected routes
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public endpoints
    const publicRoutes = [
      '/health',
      '/docs',
      '/auth',
      '/webhook',
      '/docs/json',
      '/docs/yaml',
      '/docs/static',
    ]

    const isPublicRoute = publicRoutes.some(
      route => request.url.startsWith(route) || request.url === '/'
    )

    if (isPublicRoute) {
      return
    }

    // Check authorization header
    const authorization = request.headers.authorization

    if (!authorization) {
      return reply.code(401).send({
        error: 'Authorization header is required',
        code: 401,
      })
    }

    // Validate token format
    if (!authorization.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: 'Invalid token format',
        code: 401,
      })
    }

    // Extract and validate token using AuthService from DI container
    const token = authorization.substring(7)

    try {
      const authService = container.cradle.authService
      const payload = await authService.verifyToken(token, 'access')

      // Add user to request
      request.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
      }
    } catch (error) {
      logger.error('Auth middleware error', error)

      if (error instanceof Error && error.message.includes('expired')) {
        return reply.code(401).send({
          error: 'Token expired',
          code: 401,
        })
      }

      return reply.code(401).send({
        error: 'Invalid or expired token',
        code: 401,
      })
    }
  })

  // Health check endpoint
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Health check endpoint',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              services: {
                type: 'object',
                properties: {
                  redis: { type: 'string' },
                  postgres: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (_, reply) => {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          redis: isRedisAvailable ? 'available' : 'unavailable',
          postgres: isPostgresAvailable ? 'available' : 'unavailable',
        },
      }

      // If critical services are unavailable, return degraded status
      if (!isPostgresAvailable) {
        health.status = 'degraded'
      }

      return reply.send(health)
    }
  )

  // Root endpoint
  fastify.get(
    '/',
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
            },
          },
        },
      },
    },
    async (_, reply) => {
      return reply.send({
        message: 'Welcome to Fastify Service Template',
        version: Config.SERVICE_VERSION,
        docs: '/docs',
      })
    }
  )

  // Register all routes
  fastify.register(registerRoutes)

  return fastify
}

/**
 * Initialize external services (Database, Redis)
 */
async function initializeServices() {
  // Initialize Database
  const databaseService = new DatabaseService()
  try {
    await databaseService.connect()
    isPostgresAvailable = true
    logger.info('PostgreSQL connection established')
  } catch (error) {
    isPostgresAvailable = false
    logger.warn('PostgreSQL is not available - running without database')
  }

  // Initialize Redis
  const redisService = new RedisService()
  const redisAvailable = await redisService.checkConnection()

  if (redisAvailable && Config.REDIS_URL) {
    try {
      // Note: Redis will be registered with Fastify if available
      isRedisAvailable = true
      logger.info('Redis connection available')
    } catch (error) {
      isRedisAvailable = false
      logger.warn('Redis is not available - running without cache')
    }
  }
}
