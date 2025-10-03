import { z } from 'zod'

/**
 * Health check response schema
 */
export const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string(),
  uptime: z.number(),
  services: z.object({
    database: z.string(),
    redis: z.string(),
  }),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>

/**
 * Root/welcome response schema
 */
export const welcomeResponseSchema = z.object({
  message: z.string(),
  version: z.string(),
  docs: z.string(),
  environment: z.string(),
})

export type WelcomeResponse = z.infer<typeof welcomeResponseSchema>

