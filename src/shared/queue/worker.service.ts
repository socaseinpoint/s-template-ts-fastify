import { Worker, WorkerOptions, Job, Processor } from 'bullmq'
import IORedis from 'ioredis'
import { Logger } from '@/shared/utils/logger'
import { Config } from '@/config'

const logger = new Logger('WorkerService')

export interface WorkerJobHandler<T = unknown, R = unknown> {
  (job: Job<T>): Promise<R>
}

/**
 * WorkerService - Manages BullMQ workers
 *
 * Responsibilities:
 * - Create and manage workers
 * - Process jobs from queues
 * - Handle job lifecycle events
 *
 * Usage:
 *   const workerService = new WorkerService(redisConnection)
 *   const worker = workerService.createWorker('my-queue', async (job) => {
 *     // Process job
 *     return result
 *   })
 */
export class WorkerService {
  private workers: Map<string, Worker> = new Map()

  constructor(private readonly connection: IORedis) {
    logger.info('WorkerService initialized')
  }

  /**
   * Create a BullMQ worker
   * @param queueName - Name of the queue to process
   * @param processor - Function to process jobs
   * @param options - Worker options (optional)
   * @returns Worker instance
   */
  createWorker<T = unknown, R = unknown>(
    queueName: string,
    processor: Processor<T, R>,
    options?: Partial<WorkerOptions>
  ): Worker<T, R> {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker for queue '${queueName}' already exists, returning existing instance`)
      const existingWorker = this.workers.get(queueName)
      return existingWorker as Worker<T, R>
    }

    logger.info(`Creating worker for queue: ${queueName}`)

    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.connection,
      concurrency: Config.QUEUE_CONCURRENCY,
      ...options,
    })

    // Setup event listeners
    this.setupWorkerEvents(worker, queueName)

    this.workers.set(queueName, worker as Worker<unknown, unknown>)
    logger.info(`✅ Worker for queue '${queueName}' created successfully`)

    return worker
  }

  /**
   * Setup worker event listeners
   * @param worker - Worker instance
   * @param queueName - Queue name (for logging)
   */
  private setupWorkerEvents(worker: Worker, queueName: string): void {
    // Job completed successfully
    worker.on('completed', (job: Job) => {
      logger.info(`✅ Job ${job.id} completed in queue '${queueName}'`, {
        jobId: job.id,
        jobName: job.name,
        duration: (job.finishedOn ?? 0) - (job.processedOn ?? 0),
      })
    })

    // Job failed
    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(`❌ Job ${job?.id} failed in queue '${queueName}'`, {
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        attemptsMade: job?.attemptsMade,
        attemptsMax: job?.opts.attempts,
      })
    })

    // Worker error
    worker.on('error', (error: Error) => {
      logger.error(`❌ Worker error in queue '${queueName}'`, error)
    })

    // Worker is ready
    worker.on('ready', () => {
      logger.info(`🟢 Worker for queue '${queueName}' is ready`)
    })

    // Worker is closing
    worker.on('closing', () => {
      logger.info(`🔴 Worker for queue '${queueName}' is closing...`)
    })

    // Worker closed
    worker.on('closed', () => {
      logger.info(`✅ Worker for queue '${queueName}' closed`)
    })

    // Job is active (processing started)
    worker.on('active', (job: Job) => {
      logger.debug(`⚙️  Job ${job.id} started in queue '${queueName}'`, {
        jobId: job.id,
        jobName: job.name,
      })
    })

    // Job progress updated
    worker.on('progress', (job: Job) => {
      logger.debug(`📊 Job ${job.id} progress in queue '${queueName}'`, {
        jobId: job.id,
      })
    })
  }

  /**
   * Get an existing worker
   * @param queueName - Name of the queue
   * @returns Worker instance or undefined
   */
  getWorker<T = unknown, R = unknown>(queueName: string): Worker<T, R> | undefined {
    return this.workers.get(queueName) as Worker<T, R> | undefined
  }

  /**
   * Close all workers
   * Call this during graceful shutdown
   */
  async close(): Promise<void> {
    logger.info('Closing all workers...')

    const closePromises = Array.from(this.workers.entries()).map(async ([queueName, worker]) => {
      try {
        await worker.close()
        logger.info(`✅ Worker for queue '${queueName}' closed`)
      } catch (error) {
        logger.error(`Error closing worker for queue '${queueName}'`, error)
      }
    })

    await Promise.all(closePromises)
    this.workers.clear()

    logger.info('✅ All workers closed')
  }
}
