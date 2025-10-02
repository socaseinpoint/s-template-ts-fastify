import { FastifyInstance } from 'fastify'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import itemRoutes from './item.routes'

/**
 * Register all API routes with versioning
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Register v1 API routes
  await fastify.register(
    async api => {
      // Auth routes (public)
      await api.register(authRoutes, { prefix: '/auth' })

      // User routes (protected)
      await api.register(userRoutes, { prefix: '/users' })

      // Item routes (protected)
      await api.register(itemRoutes, { prefix: '/items' })
    },
    { prefix: '/v1' }
  )

  // Future: v2 routes can be added here
  // await fastify.register(async (api) => {
  //   await api.register(authRoutesV2, { prefix: '/auth' })
  // }, { prefix: '/v2' })
}
