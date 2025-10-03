import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'
import { Logger } from '@/utils/logger'

const logger = new Logger('RequestContext')

/**
 * Request context plugin - adds correlation ID and request tracking
 * Type declarations are in src/types/fastify.d.ts
 */
export async function requestContextPlugin(fastify: FastifyInstance) {
  // Add correlation ID to every request
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get correlation ID from header or generate new one
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      randomUUID()

    // Set correlation ID on request
    request.correlationId = correlationId
    request.startTime = Date.now()

    // Add to response headers for tracing
    reply.header('x-correlation-id', correlationId)
    reply.header('x-request-id', request.id)
  })

  // Log request/response with correlation ID
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - request.startTime

    logger.info('Request completed', {
      correlationId: request.correlationId,
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: request.user?.id,
    })
  })

  logger.info('Request context plugin registered')
}
