import { FastifyInstance } from 'fastify'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import itemRoutes from './item.routes'

export async function registerRoutes(fastify: FastifyInstance) {
  // Register all route modules
  await fastify.register(authRoutes, { prefix: '/auth' })
  await fastify.register(userRoutes, { prefix: '/users' })
  await fastify.register(itemRoutes, { prefix: '/items' })
}
