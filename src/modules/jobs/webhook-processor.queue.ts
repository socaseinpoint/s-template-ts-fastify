import { Queue } from 'bullmq'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('WebhookQueue')

/**
 * Webhook processor job data
 */
export interface WebhookJobData {
  url: string
  payload: Record<string, unknown>
  headers?: Record<string, string>
  retries?: number
}

/**
 * Queue names - centralized definition
 */
export const QUEUE_NAMES = {
  WEBHOOK_PROCESSOR: 'webhook-processor',
} as const

/**
 * WebhookQueue - Example queue for processing webhooks
 *
 * This is a simple example to demonstrate the queue pattern.
 * In production, you would replace this with your actual business logic
 * (e.g., video generation, email sending, data processing, etc.)
 *
 * Usage:
 *   const webhookQueue = container.cradle.webhookQueue
 *   await addWebhookJob(webhookQueue, {
 *     url: 'https://api.example.com/webhook',
 *     payload: { event: 'user.created', userId: 123 }
 *   })
 */

/**
 * Add a webhook job to the queue
 * @param queue - Queue instance
 * @param data - Webhook job data
 * @returns Job instance
 */
export async function addWebhookJob(queue: Queue<WebhookJobData>, data: WebhookJobData) {
  logger.info(`Adding webhook job: ${data.url}`)

  const job = await queue.add('process-webhook', data, {
    attempts: data.retries ?? 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
  })

  logger.info(`✅ Webhook job added (ID: ${job.id})`)

  return job
}
