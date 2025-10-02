import { Logger } from '@/utils/logger'
import { HealthService } from '@/services/health.service'
import { DataService } from '@/services/data.service'
import { Config } from '@/config'

export class AppService {
  private logger: Logger
  private healthService: HealthService
  private dataService: DataService
  private isRunning = false

  constructor() {
    this.logger = new Logger('AppService')
    this.healthService = new HealthService()
    this.dataService = new DataService()
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Service is already running')
      return
    }

    this.logger.info('Starting app service...')

    // Initialize services
    await this.healthService.initialize()
    await this.dataService.initialize()

    // Start health check endpoint if enabled
    if (Config.ENABLE_HEALTH_CHECK) {
      await this.healthService.startHealthCheckServer()
    }

    // Example: Start your main service logic here
    this.startMainLoop()

    this.isRunning = true
    this.logger.info('App service started successfully')
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Service is not running')
      return
    }

    this.logger.info('Stopping app service...')

    // Stop services
    await this.healthService.shutdown()
    await this.dataService.shutdown()

    this.isRunning = false
    this.logger.info('App service stopped successfully')
  }

  private startMainLoop(): void {
    // Example main loop - replace with your actual business logic
    setInterval(async () => {
      if (!this.isRunning) return

      try {
        const data = await this.dataService.fetchData()
        this.logger.debug(`Processed data: ${JSON.stringify(data)}`)
      } catch (error) {
        this.logger.error('Error in main loop', error)
      }
    }, 10000) // Run every 10 seconds
  }
}
