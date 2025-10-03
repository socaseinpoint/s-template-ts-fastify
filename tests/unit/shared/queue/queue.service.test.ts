import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'

// Mock BullMQ BEFORE imports
vi.mock('bullmq', () => {
  const { MockQueue } = vi.importActual<typeof import('../../../mocks/bullmq.mock')>(
    '../../../mocks/bullmq.mock'
  )
  return { Queue: MockQueue }
})

// Mock Config
vi.mock('@/config', () => ({
  Config: {
    MODE: 'all',
    LOG_LEVEL: 'info',
    QUEUE_CONCURRENCY: 5,
    QUEUE_REMOVE_ON_COMPLETE: 100,
    QUEUE_REMOVE_ON_FAIL: 1000,
  },
}))

import { QueueService } from '@/shared/queue/queue.service'
import { MockIORedis } from '../../../mocks/bullmq.mock'

describe('QueueService', () => {
  let queueService: QueueService
  let mockRedis: MockIORedis

  beforeEach(() => {
    mockRedis = new MockIORedis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queueService = new QueueService(mockRedis as any)
  })

  describe('createQueue', () => {
    it('should create a new queue', () => {
      const queue = queueService.createQueue('test-queue')

      expect(queue).toBeDefined()
      expect(queue.name).toBe('test-queue')
    })

    it('should return existing queue if already created', () => {
      const queue1 = queueService.createQueue('test-queue')
      const queue2 = queueService.createQueue('test-queue')

      expect(queue1).toBe(queue2)
    })

    it('should create queue with custom options', () => {
      const customOptions = {
        defaultJobOptions: {
          attempts: 5,
          removeOnComplete: 50,
        },
      }

      const queue = queueService.createQueue('custom-queue', customOptions)

      expect(queue).toBeDefined()
      expect(queue.name).toBe('custom-queue')
    })
  })

  describe('getQueue', () => {
    it('should return existing queue', () => {
      queueService.createQueue('test-queue')
      const queue = queueService.getQueue('test-queue')

      expect(queue).toBeDefined()
      expect(queue?.name).toBe('test-queue')
    })

    it('should return undefined for non-existent queue', () => {
      const queue = queueService.getQueue('non-existent')

      expect(queue).toBeUndefined()
    })
  })

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const queue = queueService.createQueue('test-queue')
      const jobData = { userId: '123', action: 'test' }

      const job = await queueService.addJob(queue, 'test-job', jobData)

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
      expect(job.name).toBe('test-job')
      expect(job.data).toEqual(jobData)
    })

    it('should add job with custom options', async () => {
      const queue = queueService.createQueue('test-queue')
      const jobData = { userId: '123' }
      const jobOptions = {
        priority: 1,
        delay: 1000,
        attempts: 5,
      }

      const job = await queueService.addJob(queue, 'priority-job', jobData, jobOptions)

      expect(job).toBeDefined()
      expect(job.opts).toMatchObject(jobOptions)
    })
  })

  describe('close', () => {
    it('should close all queues', async () => {
      queueService.createQueue('queue-1')
      queueService.createQueue('queue-2')

      await queueService.close()

      // After close, getting queues should return undefined
      expect(queueService.getQueue('queue-1')).toBeUndefined()
      expect(queueService.getQueue('queue-2')).toBeUndefined()
    })

    it('should handle errors when closing queues', async () => {
      const queue = queueService.createQueue('test-queue')

      // Mock close to throw error
      queue.close = vi.fn().mockRejectedValue(new Error('Close failed'))

      // Should not throw
      await expect(queueService.close()).resolves.toBeUndefined()
    })
  })
})
