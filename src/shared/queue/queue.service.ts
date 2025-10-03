import { Queue, QueueOptions } from 'bullmq'
import IORedis from 'ioredis'
import { Logger } from '@/shared/utils/logger'
import { Config } from '@/config'

const logger = new Logger('QueueService')

/**
 * QueueService - Manages BullMQ queues
 *
 * Responsibilities:
 * - Create and manage queues
 * - Add jobs to queues
 * - Configure queue options
 *
 * Usage:
 *   const queueService = new QueueService(redisConnection)
 *   const queue = queueService.createQueue('my-queue')
 *   await queueService.addJob(queue, 'my-job', { data: 'value' })
 */
export class QueueService {
  private queues: Map<string, Queue> = new Map()

  constructor(private readonly connection: IORedis) {
    logger.info('QueueService initialized')
  }

  /**
   * Create a BullMQ queue
   * @param queueName - Name of the queue
   * @param options - Queue options (optional)
   * @returns Queue instance
   */
  createQueue<T = unknown>(queueName: string, options?: Partial<QueueOptions>): Queue<T> {
    if (this.queues.has(queueName)) {
      logger.debug(`Queue '${queueName}' already exists, returning existing instance`)
      return this.queues.get(queueName) as Queue<T>
    }

    logger.info(`Creating queue: ${queueName}`)

    const queue = new Queue<T>(queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential', // Exponential backoff: 1s, 2s, 4s
          delay: 1000,
        },
        removeOnComplete: Config.QUEUE_REMOVE_ON_COMPLETE,
        removeOnFail: Config.QUEUE_REMOVE_ON_FAIL,
      },
      ...options,
    })

    this.queues.set(queueName, queue as Queue<unknown>)
    logger.info(`✅ Queue '${queueName}' created successfully`)

    return queue
  }

  /**
   * Get an existing queue
   * @param queueName - Name of the queue
   * @returns Queue instance or undefined
   */
  getQueue<T = unknown>(queueName: string): Queue<T> | undefined {
    return this.queues.get(queueName) as Queue<T> | undefined
  }

  /**
   * Add a job to a queue
   * @param queue - Queue instance
   * @param jobName - Name of the job
   * @param data - Job data
   * @param options - Job options (optional)
   * @returns Job instance
   */
  async addJob<T>(
    queue: Queue<T>,
    jobName: string,
    data: T,
    options?: {
      priority?: number
      delay?: number
      attempts?: number
    }
  ) {
    logger.debug(`Adding job '${jobName}' to queue '${queue.name}'`)

    const job = await queue.add(jobName as any, data as any, options)

    logger.info(`✅ Job '${jobName}' added to queue '${queue.name}' (ID: ${job.id})`)

    return job
  }

  /**
   * Close all queues
   * Call this during graceful shutdown
   */
  async close(): Promise<void> {
    logger.info('Closing all queues...')

    const closePromises = Array.from(this.queues.values()).map(async queue => {
      try {
        await queue.close()
        logger.info(`✅ Queue '${queue.name}' closed`)
      } catch (error) {
        logger.error(`Error closing queue '${queue.name}'`, error)
      }
    })

    await Promise.all(closePromises)
    this.queues.clear()

    logger.info('✅ All queues closed')
  }
}
