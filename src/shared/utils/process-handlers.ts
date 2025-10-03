import { Logger } from '@/shared/utils/logger'
import { gracefulShutdown, ShutdownContext } from '@/shared/utils/graceful-shutdown'

const logger = new Logger('ProcessHandlers')

/**
 * Setup global process error handlers
 * These catch uncaught exceptions and unhandled promise rejections
 */
export function setupProcessErrorHandlers(context: ShutdownContext): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('❌ UNCAUGHT EXCEPTION - This should never happen!', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    })

    // In production, you might want to send this to an error tracking service
    // (Sentry, Rollbar, etc.) before shutting down

    // Attempt graceful shutdown
    gracefulShutdown('UNCAUGHT_EXCEPTION', context).catch(() => {
      process.exit(1)
    })
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('❌ UNHANDLED PROMISE REJECTION - This should never happen!', {
      reason,
      promise,
    })

    // In production, you might want to send this to an error tracking service
    // (Sentry, Rollbar, etc.) before shutting down

    // Attempt graceful shutdown
    gracefulShutdown('UNHANDLED_REJECTION', context).catch(() => {
      process.exit(1)
    })
  })

  // Handle warning events (optional, for debugging)
  process.on('warning', (warning: Error) => {
    logger.warn('⚠️  Process warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    })
  })

  logger.info('✅ Process error handlers registered')
}
