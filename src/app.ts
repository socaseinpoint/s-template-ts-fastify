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
import { createDIContainer, DIContainer } from '@/container'
import { errorHandler } from '@/middleware/error-handler.middleware'
import { ServiceRegistry, getServiceRegistry } from '@/services/service-registry.service'
import { PUBLIC_ROUTES, AUTH, RATE_LIMITS, ROUTES, ServiceStatus } from '@/constants'

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

  // Note: Fastify instance is not registered in container to avoid circular dependency
  // If needed, access it through the routes' closure scope

  // Register centralized error handler
  fastify.setErrorHandler(errorHandler)

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
  fastify.register(fastifyFormbody)

  // Register JWT plugin
  fastify.register(jwtPlugin)

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
  fastify.register(fastifyCors, {
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  // Global auth middleware for protected routes
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public endpoints
    const isPublicRoute = PUBLIC_ROUTES.some(
      route => request.url.startsWith(route) || request.url === ROUTES.ROOT
    )

    if (isPublicRoute) {
      return
    }

    // Check authorization header
    const authorization = request.headers[AUTH.HEADER_NAME]

    if (!authorization) {
      return reply.code(401).send({
        error: 'Authorization header is required',
        code: 401,
      })
    }

    // Validate token format
    if (!authorization.startsWith(AUTH.BEARER_PREFIX)) {
      return reply.code(401).send({
        error: 'Invalid token format. Use: Bearer <token>',
        code: 401,
      })
    }

    // Extract and validate token using AuthService from DI container
    const token = authorization.substring(AUTH.BEARER_PREFIX.length)

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
