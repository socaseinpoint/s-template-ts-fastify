import 'fastify'
import { UserRole } from '@/constants'

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string
      email: string
      role: UserRole
    }
    // Request context properties (set by request-context.plugin)
    correlationId: string
    startTime: number
  }
}
