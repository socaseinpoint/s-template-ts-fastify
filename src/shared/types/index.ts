/**
 * Types Module
 * Exports all type definitions
 */

export * from './fastify.d'

/**
 * Token payload interface
 */
export interface TokenPayload {
  id: string
  email: string
  role: string
  type: 'access' | 'refresh'
  iat?: number
  exp?: number
}
