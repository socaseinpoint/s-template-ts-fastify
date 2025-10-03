import { FastifyPluginAsync } from 'fastify'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'
import { Registry, Counter, Histogram, Gauge } from 'prom-client'
import { Config } from '@/config'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('Monitoring')

/**
 * Monitoring Plugin
 *
 * Provides:
 * - Bull Board UI at /admin/queues (queue monitoring)
 * - Prometheus metrics at /metrics
 */
export const monitoringPlugin: FastifyPluginAsync = async fastify => {
  const container = fastify.diContainer

  // =================================================================
  // Bull Board - Queue Monitoring UI
  // =================================================================
  if (Config.MODE === 'api' || Config.MODE === 'all') {
    try {
      const queues = []

      // Add all available queues
      if (container.cradle.webhookQueue) {
        queues.push(new BullMQAdapter(container.cradle.webhookQueue))
      }

      if (queues.length > 0) {
        const serverAdapter = new FastifyAdapter()
        serverAdapter.setBasePath('/admin/queues')

        createBullBoard({
          queues,
          serverAdapter,
        })

        await fastify.register(serverAdapter.registerPlugin(), {
          prefix: '/admin/queues',
        })

        logger.info('✅ Bull Board UI enabled at /admin/queues')
      }
    } catch (error) {
      logger.warn('⚠️  Bull Board initialization failed', error)
    }
  }

  // =================================================================
  // Prometheus Metrics
  // =================================================================
  const register = new Registry()

  // HTTP metrics
  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  })

  const httpRequestTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  })

  // Queue metrics
  const queueJobsProcessed = new Counter({
    name: 'queue_jobs_processed_total',
    help: 'Total jobs processed',
    labelNames: ['queue', 'status'],
    registers: [register],
  })

  const queueJobDuration = new Histogram({
    name: 'queue_job_duration_seconds',
    help: 'Job processing duration',
    labelNames: ['queue'],
    registers: [register],
  })

  const queueLength = new Gauge({
    name: 'queue_length',
    help: 'Current queue length',
    labelNames: ['queue', 'state'],
    registers: [register],
  })

  // Collect default metrics (CPU, memory, etc.)
  register.setDefaultLabels({
    app: Config.SERVICE_NAME,
    version: Config.SERVICE_VERSION,
    mode: Config.MODE,
  })

  // HTTP metrics hook
  fastify.addHook('onRequest', async (_, reply) => {
    reply.locals = { startTime: Date.now() }
  })

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - reply.locals.startTime) / 1000
    const route = request.routeOptions.url || request.url

    httpRequestDuration.labels(request.method, route, reply.statusCode.toString()).observe(duration)
    httpRequestTotal.labels(request.method, route, reply.statusCode.toString()).inc()
  })

  // Metrics endpoint
  fastify.get('/metrics', async (_, reply) => {
    // Update queue metrics before returning
    try {
      if (container.cradle.webhookQueue) {
        const queue = container.cradle.webhookQueue
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ])

        queueLength.labels('webhook-processor', 'waiting').set(waiting)
        queueLength.labels('webhook-processor', 'active').set(active)
        queueLength.labels('webhook-processor', 'completed').set(completed)
        queueLength.labels('webhook-processor', 'failed').set(failed)
      }
    } catch (error) {
      // Silently fail - metrics are not critical
    }

    reply.type('text/plain')
    return register.metrics()
  })

  logger.info('✅ Prometheus metrics enabled at /metrics')

  // Export metrics for worker event handlers
  fastify.decorate('metrics', {
    queueJobsProcessed,
    queueJobDuration,
  })
}

// Type augmentation
declare module 'fastify' {
  interface FastifyReply {
    locals: {
      startTime: number
    }
  }

  interface FastifyInstance {
    metrics: {
      queueJobsProcessed: Counter<string>
      queueJobDuration: Histogram<string>
    }
  }
}
