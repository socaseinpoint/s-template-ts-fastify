import { FastifyInstance } from 'fastify'
import fastifyInstance from '@/server'

let server: FastifyInstance | null = null

/**
 * Get or create a test server instance
 * Reuses the same instance for better performance
 */
export async function getTestServer(): Promise<FastifyInstance> {
  if (!server) {
    server = fastifyInstance
    // Server should already be ready, but ensure it
    if (!server.hasReqDecorator) {
      await server.ready()
    }
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
 * Get the server instance directly (already initialized)
 */
export function getServerInstance(): FastifyInstance {
  return fastifyInstance
}
