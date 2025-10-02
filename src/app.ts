import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyFormbody from '@fastify/formbody'
import { swaggerConfig, swaggerUiConfig } from '@/config/swagger'
import { registerRoutes } from '@/routes'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'
import { jwtPlugin } from '@/plugins/jwt.plugin'
import { requestContextPlugin } from '@/plugins/request-context.plugin'
import { createDIContainer, DIContainer } from '@/container'
import { errorHandler } from '@/middleware/error-handler.middleware'
import { ServiceRegistry, getServiceRegistry } from '@/services/service-registry.service'
import { RATE_LIMITS, ROUTES, ServiceStatus } from '@/constants'

const logger = new Logger('App')

// Service Registry (replaces global mutable state)
let serviceRegistry: ServiceRegistry

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

  // Initialize Service Registry
  serviceRegistry = getServiceRegistry()
  await serviceRegistry.initialize()

  // Create DI container
  const container = createDIContainer()
  serviceRegistry.container = container

  // Decorate fastify with container for access in plugins/routes
  fastify.decorate('diContainer', container)

  // Register centralized error handler
  fastify.setErrorHandler(errorHandler)

  // Register request context plugin (correlation ID, tracing)
  await fastify.register(requestContextPlugin)

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
    // Global rate limit
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
    fastify.register(fastifySwagger, swaggerConfig)
    fastify.register(fastifySwaggerUi, swaggerUiConfig)
  }

  // Configure CORS
  const getCorsOrigin = () => {
    if (Config.NODE_ENV === 'production') {
      return Config.CORS_ORIGIN === '*' ? false : Config.CORS_ORIGIN
    }
    return '*'
  }

  // Enable CORS
  await fastify.register(fastifyCors, {
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID'],
    exposedHeaders: ['X-Correlation-ID', 'X-Request-ID'],
    credentials: true,
  })

  // Health check endpoint with live checks
  fastify.get(
    ROUTES.HEALTH,
    {
      schema: {
        description: 'Health check endpoint with live service status',
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
      const health = serviceRegistry.getHealth()

      const status = health.postgres === false ? ServiceStatus.DEGRADED : ServiceStatus.AVAILABLE

      return reply.send({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          redis: health.redis ? ServiceStatus.AVAILABLE : ServiceStatus.UNAVAILABLE,
          postgres: health.postgres ? ServiceStatus.AVAILABLE : ServiceStatus.UNAVAILABLE,
        },
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
      })
    }
  )

  // Register all routes
  fastify.register(registerRoutes)

  return fastify
}

/**
 * Get service registry instance
 */
export function getAppServiceRegistry(): ServiceRegistry {
  return serviceRegistry
}

/**
 * Get DI container
 */
export function getContainer(): DIContainer | undefined {
  return serviceRegistry?.container
}

// Type declaration for Fastify decorator
declare module 'fastify' {
  interface FastifyInstance {
    diContainer: DIContainer
  }
}
