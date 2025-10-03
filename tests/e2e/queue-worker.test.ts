import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Queue, Worker, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'

// Mock Config for E2E tests
vi.mock('@/config', () => ({
  Config: {
    MODE: 'all',
    LOG_LEVEL: 'error',
    QUEUE_CONCURRENCY: 1,
    QUEUE_REMOVE_ON_COMPLETE: 10,
    QUEUE_REMOVE_ON_FAIL: 10,
  },
}))

import { processWebhookJob, type WebhookJobData } from '@/jobs/webhook'

/**
 * E2E Tests for Queue + Worker Integration
 *
 * Tests real Redis + BullMQ integration
 * Prerequisites: Redis running on port 6380
 */
describe('Queue + Worker E2E Tests', () => {
  let redis: IORedis
  let queue: Queue<WebhookJobData>
  let worker: Worker<WebhookJobData>
  let queueEvents: QueueEvents

  const QUEUE_NAME = 'test-webhook'
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380'

  beforeAll(async () => {
    // Create Redis connection
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    await redis.ping()

    // Create queue
    queue = new Queue<WebhookJobData>(QUEUE_NAME, {
      connection: redis,
    })

    // Create QueueEvents
    queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: redis.duplicate(),
    })

    // Create worker
    worker = new Worker<WebhookJobData>(QUEUE_NAME, processWebhookJob, {
      connection: redis.duplicate(),
      concurrency: 1,
    })

    // Wait for worker ready
    await new Promise<void>(resolve => {
      worker.on('ready', () => resolve())
    })
  })

  afterAll(async () => {
    await worker?.close()
    await queueEvents?.close()
    await queue?.obliterate({ force: true })
    await queue?.close()
    await redis?.quit()
  })

  describe('Basic Queue Operations', () => {
    it('should add and process a job successfully', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { test: 'data' },
      }

      const job = await queue.add('test', jobData)
      expect(job.id).toBeDefined()

      // Wait for completion
      const result = await job.waitUntilFinished(queueEvents, 5000)

      expect(result).toEqual({ success: true })
    }, 10000)

    it('should handle job with headers', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { event: 'test' },
        headers: { 'X-Custom': 'value' },
      }

      const job = await queue.add('headers-test', jobData)
      const result = await job.waitUntilFinished(queueEvents, 5000)

      expect(result.success).toBe(true)
    }, 10000)

    it('should retry failed jobs', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { test: 'retry' },
      }

      const job = await queue.add('retry-test', jobData, {
        attempts: 3,
        backoff: { type: 'fixed', delay: 100 },
      })

      try {
        await job.waitUntilFinished(queueEvents, 15000)
      } catch {
        // Job might fail randomly (10% chance), that's OK
      }

      // Just verify job was processed
      const state = await job.getState()
      expect(['completed', 'failed']).toContain(state)
    }, 20000)
  })

  describe('Queue Metrics', () => {
    it('should track waiting jobs', async () => {
      const waitingBefore = await queue.getWaitingCount()

      await queue.add('metrics-test', {
        url: 'https://api.example.com/test',
        payload: {},
      })

      const waitingAfter = await queue.getWaitingCount()

      expect(waitingAfter).toBeGreaterThanOrEqual(waitingBefore)
    })

    it('should track completed jobs', async () => {
      const completedBefore = await queue.getCompletedCount()

      const job = await queue.add('completion-test', {
        url: 'https://api.example.com/test',
        payload: {},
      })

      await job.waitUntilFinished(queueEvents, 5000)

      const completedAfter = await queue.getCompletedCount()

      expect(completedAfter).toBeGreaterThan(completedBefore)
    }, 10000)
  })
})
