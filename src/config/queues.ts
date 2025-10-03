import { Config } from '@/config'

/**
 * Queue Configuration
 *
 * Define per-queue settings for different job types:
 * - CPU-heavy jobs (video encoding, AI): Low concurrency (1-2)
 * - I/O-heavy jobs (API calls, webhooks): High concurrency (10-20)
 * - Mixed workload: Medium concurrency (5-10)
 */

export interface QueueConfig {
  concurrency: number
  removeOnComplete?: number | boolean
  removeOnFail?: number | boolean
  attempts?: number
  backoff?: {
    type: 'exponential' | 'fixed'
    delay: number
  }
}

/**
 * Queue configurations by name
 */
export const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  // Webhook - I/O heavy (HTTP requests)
  webhook: {
    concurrency: Config.QUEUE_CONCURRENCY || 10,
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1s, then 2s, 4s, etc.
    },
  },

  // Example: Video Generation - CPU heavy
  'video-generation': {
    concurrency: 2, // Low concurrency for CPU-bound tasks
    removeOnComplete: 50,
    removeOnFail: 500,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
  },

  // Example: Email Sending - I/O heavy
  'email-sender': {
    concurrency: 20, // High concurrency for I/O-bound tasks
    removeOnComplete: 200,
    removeOnFail: 1000,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },

  // Example: Data Processing - Mixed
  'data-processor': {
    concurrency: 5,
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
}

/**
 * Get queue configuration by name
 * Falls back to default if not found
 */
export function getQueueConfig(queueName: string): QueueConfig {
  return (
    QUEUE_CONFIGS[queueName] || {
      concurrency: Config.QUEUE_CONCURRENCY || 5,
      removeOnComplete: Config.QUEUE_REMOVE_ON_COMPLETE || 100,
      removeOnFail: Config.QUEUE_REMOVE_ON_FAIL || 1000,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    }
  )
}

/**
 * Override queue configuration with environment variables
 * Useful for production tuning without code changes
 *
 * Example env vars:
 *   QUEUE_WEBHOOK_PROCESSOR_CONCURRENCY=15
 *   QUEUE_VIDEO_GENERATION_CONCURRENCY=1
 */
export function getQueueConfigWithEnvOverrides(queueName: string): QueueConfig {
  const baseConfig = getQueueConfig(queueName)
  const envPrefix = `QUEUE_${queueName.toUpperCase().replace(/-/g, '_')}_`

  const concurrencyOverride = process.env[`${envPrefix}CONCURRENCY`]
  if (concurrencyOverride) {
    baseConfig.concurrency = parseInt(concurrencyOverride, 10)
  }

  const attemptsOverride = process.env[`${envPrefix}ATTEMPTS`]
  if (attemptsOverride) {
    baseConfig.attempts = parseInt(attemptsOverride, 10)
  }

  return baseConfig
}
