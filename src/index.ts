import dotenv from 'dotenv'
import { AppService } from '@/services/app.service'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'

// Load environment variables
dotenv.config()

const logger = new Logger('Main')

async function main() {
  try {
    logger.info('Starting application...')
    logger.info(`Environment: ${Config.NODE_ENV}`)
    logger.info(`Port: ${Config.PORT}`)

    const appService = new AppService()
    await appService.start()

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing application')
      await appService.stop()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing application')
      await appService.stop()
      process.exit(0)
    })
  } catch (error) {
    logger.error('Failed to start application', error)
    process.exit(1)
  }
}

main()
