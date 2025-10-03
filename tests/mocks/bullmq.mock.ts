import { vi } from 'vitest'

interface MockJob {
  id: string
  name: string
  data: unknown
  opts: Record<string, unknown>
  attemptsMade: number
  timestamp: number
  processedOn: number | null
  finishedOn: number | null
  updateProgress: ReturnType<typeof vi.fn>
}

/**
 * Mock BullMQ Queue
 */
export class MockQueue {
  name: string
  jobs: Map<string, MockJob> = new Map()
  private jobIdCounter = 1

  constructor(name: string) {
    this.name = name
  }

  async add(jobName: string, data: unknown, options?: Record<string, unknown>) {
    const jobId = String(this.jobIdCounter++)
    const job = {
      id: jobId,
      name: jobName,
      data,
      opts: options || {},
      attemptsMade: 0,
      timestamp: Date.now(),
      processedOn: null,
      finishedOn: null,
      updateProgress: vi.fn(),
    }
    this.jobs.set(jobId, job)
    return job
  }

  async close() {
    this.jobs.clear()
  }

  async getJob(jobId: string) {
    return this.jobs.get(jobId)
  }

  async getJobs() {
    return Array.from(this.jobs.values())
  }
}

type EventHandler = (...args: unknown[]) => void

/**
 * Mock BullMQ Worker
 */
export class MockWorker {
  name: string
  processor: (job: unknown) => Promise<unknown>
  options: Record<string, unknown>
  private eventHandlers: Map<string, EventHandler[]> = new Map()
  isRunning = true

  constructor(
    name: string,
    processor: (job: unknown) => Promise<unknown>,
    options?: Record<string, unknown>
  ) {
    this.name = name
    this.processor = processor
    this.options = options || {}
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)?.push(handler)
    return this
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  emit(event: string, ...args: unknown[]) {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => handler(...args))
  }

  async close() {
    this.isRunning = false
    this.emit('closing')
    this.emit('closed')
  }

  // Simulate processing a job
  async processJob(job: MockJob) {
    try {
      this.emit('active', job)
      const result = await this.processor(job)
      this.emit('completed', job, result)
      return result
    } catch (error) {
      job.attemptsMade++
      this.emit('failed', job, error)
      throw error
    }
  }
}

/**
 * Mock IORedis connection
 */
export class MockIORedis {
  private eventHandlers: Map<string, EventHandler[]> = new Map()
  isConnected = true

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)?.push(handler)
    return this
  }

  emit(event: string, ...args: unknown[]) {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => handler(...args))
  }

  async quit() {
    this.isConnected = false
    this.emit('close')
  }

  disconnect() {
    this.isConnected = false
    this.emit('close')
  }

  async ping() {
    return 'PONG'
  }
}
