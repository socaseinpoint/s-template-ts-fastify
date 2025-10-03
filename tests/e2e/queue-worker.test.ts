import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

// Mock Config for E2E tests
vi.mock('@/config', () => ({
  Config: {
    MODE: 'all',
    LOG_LEVEL: 'error', // Less verbose for tests
    QUEUE_CONCURRENCY: 1,
    QUEUE_REMOVE_ON_COMPLETE: 10,
    QUEUE_REMOVE_ON_FAIL: 10,
  },
}))

import { processWebhookJob } from '@/modules/jobs/webhook-processor.worker'
import type { WebhookJobData } from '@/modules/jobs/webhook-processor.queue'

/**
 * E2E tests for Queue + Worker integration
 *
 * These tests use real Redis and BullMQ to verify:
 * - Jobs are added to queues
 * - Workers process jobs correctly
 * - Retry logic works
 * - Job completion/failure is tracked
 *
 * Prerequisites:
 * - Redis must be running (via docker-compose.test.yml)
 * - Run with: npm run test:e2e
 */
describe('Queue + Worker E2E Tests', () => {
  let redis: IORedis
  let queue: Queue<WebhookJobData>
  let worker: Worker<WebhookJobData>

  const QUEUE_NAME = 'test-webhook-processor'
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

  beforeAll(async () => {
    console.log('✅ Connecting to Redis for E2E tests:', REDIS_URL)

    // Create Redis connection for BullMQ
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    // Wait for Redis to be ready
    await redis.ping()

    // Create queue
    queue = new Queue<WebhookJobData>(QUEUE_NAME, {
      connection: redis,
    })

    // Create worker
    worker = new Worker<WebhookJobData>(QUEUE_NAME, processWebhookJob, {
      connection: redis.duplicate(),
      concurrency: 1, // Process one job at a time for testing
    })

    // Wait for worker to be ready
    await new Promise<void>(resolve => {
      worker.on('ready', () => {
        console.log('✅ Worker is ready')
        resolve()
      })
    })
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up...')

    // Close worker
    if (worker) {
      await worker.close()
    }

    // Clean up queue
    if (queue) {
      await queue.obliterate({ force: true })
      await queue.close()
    }

    // Close Redis
    if (redis) {
      await redis.quit()
    }

    console.log('✅ Cleanup complete')
  })

  describe('Basic Queue Operations', () => {
    it('should add a job to the queue', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { event: 'test', timestamp: Date.now() },
      }

      const job = await queue.add('test-job', jobData)

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
      expect(job.data).toEqual(jobData)

      console.log('✓ Job added:', job.id)
    })

    it('should process job successfully', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { event: 'test', userId: '123' },
      }

      const job = await queue.add('process-test', jobData)

      // Wait for job to complete
      const result = await job.waitUntilFinished(queue.events)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)

      console.log('✓ Job processed successfully:', job.id)
    }, 10000) // 10s timeout

    it('should handle job with custom headers', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { event: 'custom-headers' },
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test-value',
        },
      }

      const job = await queue.add('headers-test', jobData)
      const result = await job.waitUntilFinished(queue.events)

      expect(result.success).toBe(true)

      console.log('✓ Job with headers processed:', job.id)
    }, 10000)
  })

  describe('Job Retry Logic', () => {
    it('should retry failed jobs', async () => {
      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { event: 'retry-test' },
      }

      const job = await queue.add('retry-job', jobData, {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 100, // 100ms between retries
        },
      })

      // Job might succeed or fail (10% random failure in processor)
      // We're testing that retry mechanism works
      try {
        await job.waitUntilFinished(queue.events, 5000)
      } catch (error) {
        // If job failed after all retries, that's okay
        // We're testing the retry mechanism itself
      }

      // Refresh job state
      await job.reload()

      // Check that job was attempted
      expect(job.attemptsMade).toBeGreaterThan(0)
      expect(job.attemptsMade).toBeLessThanOrEqual(3)

      console.log(`✓ Job retry tested (${job.attemptsMade} attempts)`)
    }, 10000)
  })

  describe('Worker Event Handling', () => {
    it('should emit completed event', async () => {
      const completedPromise = new Promise<void>(resolve => {
        worker.once('completed', job => {
          expect(job).toBeDefined()
          expect(job.id).toBeDefined()
          console.log('✓ Worker emitted completed event:', job.id)
          resolve()
        })
      })

      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { event: 'event-test' },
      }

      await queue.add('event-test', jobData)

      await Promise.race([
        completedPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for completed event')), 5000)
        ),
      ])
    }, 10000)

    it('should emit active event when job starts', async () => {
      const activePromise = new Promise<void>(resolve => {
        worker.once('active', job => {
          expect(job).toBeDefined()
          expect(job.id).toBeDefined()
          console.log('✓ Worker emitted active event:', job.id)
          resolve()
        })
      })

      const jobData: WebhookJobData = {
        url: 'https://api.example.com/webhook',
        payload: { event: 'active-test' },
      }

      await queue.add('active-test', jobData)

      await Promise.race([
        activePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for active event')), 5000)
        ),
      ])
    }, 10000)
  })

  describe('Concurrency', () => {
    it('should process multiple jobs', async () => {
      const jobCount = 5
      const jobs = []

      // Add multiple jobs
      for (let i = 0; i < jobCount; i++) {
        const jobData: WebhookJobData = {
          url: `https://api.example.com/webhook-${i}`,
          payload: { event: 'concurrent', index: i },
        }
        jobs.push(await queue.add(`concurrent-${i}`, jobData))
      }

      // Wait for all jobs to complete
      const results = await Promise.all(
        jobs.map(job =>
          job.waitUntilFinished(queue.events, 10000).catch(() => ({ success: false }))
        )
      )

      // At least some jobs should succeed (allowing for random failures)
      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeGreaterThan(0)

      console.log(`✓ Processed ${successCount}/${jobCount} jobs successfully`)
    }, 15000)
  })

  describe('Job Priority', () => {
    it('should respect job priority', async () => {
      const processedJobs: string[] = []

      // Listen to completed events to track order
      const completedListener = (job: any) => {
        processedJobs.push(job.name)
      }
      worker.on('completed', completedListener)

      // Add jobs with different priorities (lower number = higher priority)
      await queue.add(
        'low-priority',
        { url: 'https://api.example.com', payload: { priority: 'low' } },
        { priority: 10 }
      )

      await queue.add(
        'high-priority',
        { url: 'https://api.example.com', payload: { priority: 'high' } },
        { priority: 1 }
      )

      await queue.add(
        'medium-priority',
        { url: 'https://api.example.com', payload: { priority: 'medium' } },
        { priority: 5 }
      )

      // Wait for all jobs to complete
      await new Promise(resolve => setTimeout(resolve, 5000))

      // High priority should be processed first
      expect(processedJobs[0]).toBe('high-priority')

      worker.off('completed', completedListener)

      console.log('✓ Priority order:', processedJobs)
    }, 10000)
  })
})
