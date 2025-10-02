import dotenv from 'dotenv'
dotenv.config()

import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
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

const logger = new Logger('Server')

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

// Service availability flags
let isRedisAvailable = false
let isPostgresAvailable = false

// Register form body parser
fastify.register(fastifyFormbody)

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

// Auth middleware
fastify.addHook('preHandler', async (request, reply) => {
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

  // Extract and validate token
  const token = authorization.substring(7)

  try {
    // Here you would validate the token
    // For now, we'll just check if it exists
    if (!token || token === 'invalid') {
      return reply.code(401).send({
        error: 'Invalid token',
        code: 401,
      })
    }

    // Add user to request (mock user for now)
    ;(request as any).user = {
      id: '1',
      email: 'user@example.com',
      role: 'user',
    }
  } catch (error) {
    logger.error('Auth middleware error', error)
    return reply.code(500).send({
      error: 'Internal server error',
      code: 500,
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

// Initialize services
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
      await fastify.register(fastifyRedis, {
        url: Config.REDIS_URL,
        connectTimeout: 5000,
      })

      isRedisAvailable = true
      logger.info('Redis connection established')
    } catch (error) {
      isRedisAvailable = false
      logger.warn('Redis is not available - running without cache')
    }
  }
}

// Start server function
async function startServer() {
  try {
    logger.info('Starting server initialization...')

    // Initialize services
    await initializeServices()

    // Start the server
    const address = await fastify.listen({
      port: Config.PORT,
      host: Config.HOST || '0.0.0.0',
    })

    logger.info(`Server running on ${address}`)
    logger.info(`Swagger docs available at ${address}/docs`)

    // Service status
    logger.info('=== Services Status ===')
    logger.info(`Redis: ${isRedisAvailable ? '✅ Available' : '❌ Unavailable'}`)
    logger.info(`PostgreSQL: ${isPostgresAvailable ? '✅ Available' : '❌ Unavailable'}`)
    logger.info('=======================')

    // Print routes in development
    if (Config.NODE_ENV === 'development') {
      console.log('\n=== Registered routes ===')
      console.log(fastify.printRoutes())
      console.log('========================\n')
    }
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown`)

  try {
    await fastify.close()
    logger.info('Server closed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Start the server
startServer()

// Export for testing
export default fastify
