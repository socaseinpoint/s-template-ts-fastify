import { describe, it, expect, vi } from 'vitest'

// Mock Config
vi.mock('@/config', () => ({
  Config: {
    MODE: 'all',
    LOG_LEVEL: 'info',
    QUEUE_CONCURRENCY: 5,
  },
}))

import { processWebhookJob, type WebhookJobData } from '@/jobs/webhook'

interface MockJob {
  id: string
  name: string
  data: WebhookJobData
  attemptsMade: number
  updateProgress: ReturnType<typeof vi.fn>
}

describe('WebhookProcessor', () => {
  describe('processWebhookJob', () => {
    it('should process webhook job successfully', async () => {
      const mockJob: MockJob = {
        id: '1',
        name: 'process-webhook',
        data: {
          url: 'https://api.example.com/webhook',
          payload: { event: 'test', userId: '123' },
          headers: { 'Content-Type': 'application/json' },
        },
        attemptsMade: 0,
        updateProgress: vi.fn(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await processWebhookJob(mockJob as any)

      expect(result).toEqual({ success: true })
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10)
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100)
    })

    it('should report progress during processing', async () => {
      const mockJob: MockJob = {
        id: '1',
        name: 'process-webhook',
        data: {
          url: 'https://api.example.com/webhook',
          payload: { event: 'test' },
        },
        attemptsMade: 0,
        updateProgress: vi.fn(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await processWebhookJob(mockJob as any)

      // Check that progress was updated
      expect(mockJob.updateProgress).toHaveBeenCalledTimes(2)
      expect(mockJob.updateProgress).toHaveBeenNthCalledWith(1, 10)
      expect(mockJob.updateProgress).toHaveBeenNthCalledWith(2, 100)
    })

    it('should handle webhook delivery failures', async () => {
      const mockJob: MockJob = {
        id: '1',
        name: 'process-webhook',
        data: {
          url: 'https://api.example.com/webhook',
          payload: { event: 'test' },
        },
        attemptsMade: 0,
        updateProgress: vi.fn(),
      }

    // Mock Math.random to force failure
    const originalRandom = Math.random
    Math.random = vi.fn(() => 0.05) // < 0.1 = triggers failure

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await processWebhookJob(mockJob as any)
      
      // Should not reach here
      expect.fail('Expected error to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Simulated failure')
    } finally {
      Math.random = originalRandom
    }
    })

    it('should include job metadata in logs', async () => {
      const mockJob: MockJob = {
        id: 'test-job-123',
        name: 'process-webhook',
        data: {
          url: 'https://api.example.com/webhook',
          payload: { userId: '456', event: 'user.created' },
        },
        attemptsMade: 1,
        updateProgress: vi.fn(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await processWebhookJob(mockJob as any)

      expect(result.success).toBe(true)
    })

    it('should handle jobs with retry attempts', async () => {
      const mockJob: MockJob = {
        id: '1',
        name: 'process-webhook',
        data: {
          url: 'https://api.example.com/webhook',
          payload: { event: 'retry-test' },
          retries: 5,
        },
        attemptsMade: 2, // Second retry
        updateProgress: vi.fn(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await processWebhookJob(mockJob as any)

      expect(result.success).toBe(true)
    })
  })
})
