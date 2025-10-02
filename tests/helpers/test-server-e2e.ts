import { createApp, AppContext } from '@/app'
import { Logger } from '@/utils/logger'

const logger = new Logger('TestServerE2E')

let appContext: AppContext | null = null

/**
 * Start E2E test server
 * Uses DATABASE_URL from environment (set by test script)
 */
export async function startE2EServer(port: number = 3001): Promise<{ url: string; port: number }> {
  if (appContext) {
    return { url: `http://localhost:${port}`, port }
  }

  try {
    logger.info('Starting E2E test server...')

    // Create and start app (uses DATABASE_URL from .env.test)
    appContext = await createApp()
    
    await appContext.fastify.listen({
      port,
      host: '0.0.0.0',
    })

    logger.info(`✅ E2E test server started on port ${port}`)
    
    return { url: `http://localhost:${port}`, port }
  } catch (error) {
    logger.error('Failed to start E2E test server', error)
    throw error
  }
}

/**
 * Stop E2E test server
 */
export async function stopE2EServer(): Promise<void> {
  if (appContext) {
    try {
      logger.info('Stopping E2E test server...')
      await appContext.fastify.close()
      await appContext.container.dispose()
      appContext = null
      logger.info('✅ E2E test server stopped')
    } catch (error) {
      logger.error('Error stopping E2E test server', error)
    }
  }
}

/**
 * Get server info
 */
export function getE2EServerInfo(): { url: string; port: number } | null {
  if (!appContext) return null
  
  const address = appContext.fastify.server.address()
  if (typeof address === 'string') {
    return { url: address, port: 3001 }
  }
  if (address && 'port' in address) {
    return { url: `http://localhost:${address.port}`, port: address.port }
  }
  return null
}
