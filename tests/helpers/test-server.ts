import { FastifyInstance } from 'fastify'
import { createApp } from '@/app'

let server: FastifyInstance | null = null

/**
 * Get or create a test server instance
 * Creates app without starting actual server
 */
export async function getTestServer(): Promise<FastifyInstance> {
  if (!server) {
    // Create app without starting server (no listen())
    server = await createApp()
    await server.ready()
  }
  return server
}

/**
 * Close the test server and clean up resources
 */
export async function closeTestServer(): Promise<void> {
  if (server) {
    await server.close()
    server = null
  }
}

/**
 * Get the server instance directly
 */
export function getServerInstance(): FastifyInstance | null {
  return server
}
