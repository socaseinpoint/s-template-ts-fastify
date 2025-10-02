import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { ValidationError } from '@/utils/errors'

/**
 * Zod validation middleware for Fastify
 * FIXED: Proper input validation at the route level
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate and transform the body
      request.body = schema.parse(request.body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }))

        throw new ValidationError('Validation failed', 400, errors)
      }
      throw error
    }
  }
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }))

        throw new ValidationError('Query validation failed', 400, errors)
      }
      throw error
    }
  }
}

/**
 * Validate route parameters
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.params = schema.parse(request.params)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }))

        throw new ValidationError('Parameters validation failed', 400, errors)
      }
      throw error
    }
  }
}
