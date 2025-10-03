import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock BullMQ BEFORE imports
vi.mock('bullmq', () => {
  const { MockWorker } = vi.importActual<typeof import('../../../mocks/bullmq.mock')>(
    '../../../mocks/bullmq.mock'
  )
  return { Worker: MockWorker }
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

import { WorkerService } from '@/shared/queue/worker.service'
import { MockWorker, MockIORedis } from '../../../mocks/bullmq.mock'

describe('WorkerService', () => {
  let workerService: WorkerService
  let mockRedis: MockIORedis

  beforeEach(() => {
    mockRedis = new MockIORedis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workerService = new WorkerService(mockRedis as any)
  })

  describe('createWorker', () => {
    it('should create a new worker', () => {
      const processor = vi.fn().mockResolvedValue({ success: true })
      const worker = workerService.createWorker('test-queue', processor)

      expect(worker).toBeDefined()
      expect(worker.name).toBe('test-queue')
      expect(worker.processor).toBe(processor)
    })

    it('should return existing worker if already created', () => {
      const processor = vi.fn()
      const worker1 = workerService.createWorker('test-queue', processor)
      const worker2 = workerService.createWorker('test-queue', processor)

      expect(worker1).toBe(worker2)
    })

    it('should create worker with custom options', () => {
      const processor = vi.fn()
      const customOptions = {
        concurrency: 10,
      }

      const worker = workerService.createWorker('custom-queue', processor, customOptions)

      expect(worker).toBeDefined()
      expect(worker.options).toMatchObject(customOptions)
    })

    it('should setup event listeners', () => {
      const processor = vi.fn()
      const worker = workerService.createWorker('test-queue', processor)

      // Worker should have event listeners registered
      expect(worker['eventHandlers'].size).toBeGreaterThan(0)
    })
  })

  describe('worker events', () => {
    it('should emit completed event when job succeeds', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true })
      const worker = workerService.createWorker('test-queue', processor) as MockWorker

      const mockJob = {
        id: '1',
        name: 'test-job',
        data: { test: 'data' },
        processedOn: Date.now(),
        finishedOn: Date.now() + 1000,
      }

      const completedSpy = vi.fn()
      worker.on('completed', completedSpy)

      await worker.processJob(mockJob)

      expect(completedSpy).toHaveBeenCalledWith(mockJob, { success: true })
    })

    it('should emit failed event when job fails', async () => {
      const error = new Error('Job failed')
      const processor = vi.fn().mockRejectedValue(error)
      const worker = workerService.createWorker('test-queue', processor) as MockWorker

      const mockJob = {
        id: '1',
        name: 'test-job',
        data: { test: 'data' },
        attemptsMade: 0,
      }

      const failedSpy = vi.fn()
      worker.on('failed', failedSpy)

      await expect(worker.processJob(mockJob)).rejects.toThrow('Job failed')
      expect(failedSpy).toHaveBeenCalledWith(mockJob, error)
      expect(mockJob.attemptsMade).toBe(1)
    })

    it('should emit active event when job starts', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true })
      const worker = workerService.createWorker('test-queue', processor) as MockWorker

      const mockJob = {
        id: '1',
        name: 'test-job',
        data: { test: 'data' },
      }

      const activeSpy = vi.fn()
      worker.on('active', activeSpy)

      await worker.processJob(mockJob)

      expect(activeSpy).toHaveBeenCalledWith(mockJob)
    })
  })

  describe('getWorker', () => {
    it('should return existing worker', () => {
      const processor = vi.fn()
      workerService.createWorker('test-queue', processor)
      const worker = workerService.getWorker('test-queue')

      expect(worker).toBeDefined()
      expect(worker?.name).toBe('test-queue')
    })

    it('should return undefined for non-existent worker', () => {
      const worker = workerService.getWorker('non-existent')

      expect(worker).toBeUndefined()
    })
  })

  describe('close', () => {
    it('should close all workers', async () => {
      const processor = vi.fn()
      workerService.createWorker('worker-1', processor)
      workerService.createWorker('worker-2', processor)

      await workerService.close()

      // After close, getting workers should return undefined
      expect(workerService.getWorker('worker-1')).toBeUndefined()
      expect(workerService.getWorker('worker-2')).toBeUndefined()
    })

    it('should emit closing and closed events', async () => {
      const processor = vi.fn()
      const worker = workerService.createWorker('test-queue', processor) as MockWorker

      const closingSpy = vi.fn()
      const closedSpy = vi.fn()
      worker.on('closing', closingSpy)
      worker.on('closed', closedSpy)

      await workerService.close()

      expect(closingSpy).toHaveBeenCalled()
      expect(closedSpy).toHaveBeenCalled()
    })

    it('should handle errors when closing workers', async () => {
      const processor = vi.fn()
      const worker = workerService.createWorker('test-queue', processor)

      // Mock close to throw error
      worker.close = vi.fn().mockRejectedValue(new Error('Close failed'))

      // Should not throw
      await expect(workerService.close()).resolves.toBeUndefined()
    })
  })
})
