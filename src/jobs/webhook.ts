/**
 * Webhook Job Processor
 *
 * Worker: Calls external API
 * API: Handles results via event handlers
 */

import { Job, Queue } from 'bullmq'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('WebhookJob')

// =============================================================================
// Job Data Types
// =============================================================================

export interface WebhookJobData {
  url: string
  payload: Record<string, unknown>
  headers?: Record<string, string>
  retries?: number
}

export const QUEUE_NAMES = {
  WEBHOOK: 'webhook',
} as const

// =============================================================================
// Worker Processor (NO database access!)
// =============================================================================

export async function processWebhookJob(job: Job<WebhookJobData>): Promise<{ success: boolean }> {
  const { url } = job.data

  logger.info(`Processing webhook job ${job.id}`, { url })

  try {
    await job.updateProgress(10)

    // TODO: Replace with actual HTTP request
    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', ...headers },
    //   body: JSON.stringify(payload),
    // })
    //
    // if (!response.ok) {
    //   throw new Error(`Webhook failed: ${response.status}`)
    // }

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (Math.random() < 0.1) throw new Error('Simulated failure')

    await job.updateProgress(100)

    logger.info(`✅ Webhook delivered to ${url}`)

    return { success: true }
  } catch (error) {
    logger.error(`❌ Webhook failed`, {
      url,
      error: error instanceof Error ? error.message : 'Unknown',
    })

    throw error // BullMQ will retry
  }
}

// =============================================================================
// Queue Helper
// =============================================================================

export async function addWebhookJob(queue: Queue<WebhookJobData>, data: WebhookJobData) {
  logger.info(`Adding webhook job: ${data.url}`)

  const job = await queue.add('process', data, {
    attempts: data.retries ?? 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })

  logger.info(`✅ Webhook job added (ID: ${job.id})`)
  return job
}
