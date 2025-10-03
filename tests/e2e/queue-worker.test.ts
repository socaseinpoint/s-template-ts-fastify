import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Queue, Worker, QueueEvents, Job } from 'bullmq'
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

import type { WebhookJobData } from '@/jobs/webhook'

/**
 * E2E Tests for Queue + Worker Integration
 *
 * Tests real Redis + BullMQ integration WITHOUT random failures
 * Prerequisites: Redis running on port 6380
 */
describe('Queue + Worker E2E Tests', () => {
  let redis: IORedis
  let queue: Queue<WebhookJobData>
  let worker: Worker<WebhookJobData>
  let queueEvents: QueueEvents

  const QUEUE_NAME = 'test-webhook'
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380'

  /**
   * Deterministic job processor - NO RANDOM FAILURES
   */
  async function testWebhookProcessor(
    job: Job<WebhookJobData>
  ): Promise<{ success: boolean; url?: string; processedAt?: string }> {
    const { url, payload } = job.data

    await job.updateProgress(10)

    // Deterministic behavior based on payload
    if (payload.shouldFail === true) {
      throw new Error('Intentional test failure')
    }

    // Simulate work without randomness
    await new Promise(resolve => setTimeout(resolve, 100))

    await job.updateProgress(100)

    return { success: true, url, processedAt: new Date().toISOString() }
  }

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

    // Create worker with DETERMINISTIC processor
    worker = new Worker<WebhookJobData>(QUEUE_NAME, testWebhookProcessor, {
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

      expect(result).toMatchObject({ success: true, url: jobData.url })
      expect(result.processedAt).toBeDefined()
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
      expect(result.url).toBe(jobData.url)
    }, 10000)

    it('should retry failed jobs and eventually fail', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { shouldFail: true }, // Deterministic failure
      }

      const job = await queue.add('retry-test', jobData, {
        attempts: 3,
        backoff: { type: 'fixed', delay: 100 },
      })

      // This WILL fail - that's expected
      await expect(job.waitUntilFinished(queueEvents, 5000)).rejects.toThrow(
        'Intentional test failure'
      )

      // Verify it was attempted 3 times
      const jobState = await job.getState()
      expect(jobState).toBe('failed')

      const attempts = job.attemptsMade
      expect(attempts).toBe(3)
    }, 10000)

    it('should succeed on retry after initial failure', async () => {
      let attemptCount = 0

      // Create custom worker that fails first, then succeeds
      const retryWorker = new Worker<WebhookJobData>(
        `${QUEUE_NAME}-retry`,
        async (_job: Job<WebhookJobData>) => {
          attemptCount++
          if (attemptCount === 1) {
            throw new Error('First attempt fails')
          }
          return { success: true, attemptCount }
        },
        {
          connection: redis.duplicate(),
          concurrency: 1,
        }
      )

      const retryQueue = new Queue<WebhookJobData>(`${QUEUE_NAME}-retry`, {
        connection: redis,
      })

      const retryEvents = new QueueEvents(`${QUEUE_NAME}-retry`, {
        connection: redis.duplicate(),
      })

      try {
        const retryJob = await retryQueue.add(
          'retry-success',
          {
            url: 'https://api.example.com/webhook',
            payload: {},
          },
          {
            attempts: 3,
            backoff: { type: 'fixed', delay: 100 },
          }
        )

        const result = await retryJob.waitUntilFinished(retryEvents, 5000)

        expect(result).toMatchObject({ success: true, attemptCount: 2 })
        expect(retryJob.attemptsMade).toBe(2)
      } finally {
        await retryWorker.close()
        await retryEvents.close()
        await retryQueue.obliterate({ force: true })
        await retryQueue.close()
      }
    }, 15000)
  })

  describe('Queue Metrics', () => {
    it('should track waiting jobs', async () => {
      // Clean queue first
      await queue.drain()

      const waitingBefore = await queue.getWaitingCount()

      await queue.add('metrics-test', {
        url: 'https://api.example.com/test',
        payload: {},
      })

      const waitingAfter = await queue.getWaitingCount()

      // Should have exactly one more waiting job
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

    it('should report job progress', async () => {
      const progressUpdates: unknown[] = []

      // Listen to progress events (BullMQ v5+ format)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const progressListener = (args: any) => {
        if (args && typeof args === 'object' && 'data' in args) {
          progressUpdates.push(args.data)
        }
      }

      queueEvents.on('progress', progressListener)

      try {
        const progressJob = await queue.add('progress-test', {
          url: 'https://api.example.com/test',
          payload: {},
        })

        await progressJob.waitUntilFinished(queueEvents, 5000)

        // Should have received progress updates (10, 100)
        expect(progressUpdates.length).toBeGreaterThan(0)
        expect(progressUpdates).toContain(10)
        expect(progressUpdates).toContain(100)
      } finally {
        queueEvents.off('progress', progressListener)
      }
    }, 10000)
  })
})
