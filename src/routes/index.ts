import { FastifyInstance } from 'fastify'
import { authController } from '@/modules/auth'
import { userController } from '@/modules/users'
import { itemController } from '@/modules/items'

/**
 * Register all API routes with versioning
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Register v1 API routes
  await fastify.register(
    async api => {
      // Auth routes (public)
      await api.register(authController, { prefix: '/auth' })

      // User routes (protected)
      await api.register(userController, { prefix: '/users' })

      // Item routes (protected)
      await api.register(itemController, { prefix: '/items' })
    },
    { prefix: '/v1' }
  )

  // Future: v2 routes can be added here
  // await fastify.register(async (api) => {
  //   await api.register(authControllerV2, { prefix: '/auth' })
  // }, { prefix: '/v2' })
}
