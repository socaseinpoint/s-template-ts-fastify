import { FastifyInstance } from 'fastify'
import { createApp, AppContext } from '@/app'

let appContext: AppContext | null = null

/**
 * Get or create a test server instance
 * Creates app without starting actual server
 */
export async function getTestServer(): Promise<FastifyInstance> {
  if (!appContext) {
    // Create app without starting server (no listen())
    appContext = await createApp()
    await appContext.fastify.ready()
  }
  return appContext.fastify
}

/**
 * Close the test server and clean up resources
 */
export async function closeTestServer(): Promise<void> {
  if (appContext) {
    await appContext.fastify.close()
    await appContext.container.dispose()
    appContext = null
  }
}

/**
 * Get the server instance directly
 */
export function getServerInstance(): FastifyInstance | null {
  return appContext?.fastify || null
}

/**
 * Get the app context (for accessing container, etc.)
 */
export function getAppContext(): AppContext | null {
  return appContext
}
