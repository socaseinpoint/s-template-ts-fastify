import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '@/utils/errors'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'
import { ZodError } from 'zod'
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/library'
import { randomUUID } from 'crypto'

const logger = new Logger('ErrorHandler')

interface ErrorResponse {
  error: string
  code: number
  errorId: string // Unique error ID for tracking
  details?: unknown
  stack?: string
}

/**
 * Sanitize request body to remove sensitive data before logging
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body
  }

  const sanitized = { ...body } as Record<string, unknown>
  const sensitiveFields = ['password', 'token', 'refreshToken', 'accessToken', 'secret', 'apiKey']

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * Centralized error handler for Fastify
 * Handles all errors in one place instead of duplicating try-catch everywhere
 */
export function errorHandler(
  error: Error | FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
): FastifyReply {
  // Generate unique error ID for tracking
  const errorId = randomUUID()

  // Log error details with sanitized body and error ID
  logger.error(`Error ${errorId} on ${request.method} ${request.url}`, {
    errorId,
    error: error.message,
    stack: error.stack,
    body: sanitizeBody(request.body),
    correlationId: request.correlationId,
    userId: request.user?.id,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
  })

  // Handle known AppError instances
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.statusCode,
      errorId,
    }

    // Include validation details if present
    if (error.details) {
      response.details = error.details
    }

    // Include stack trace in development
    if (Config.NODE_ENV === 'development') {
      response.stack = error.stack
    }

    return reply.code(error.statusCode).send(response)
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Validation failed',
      code: 400,
      errorId,
      details: error.issues.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    })
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    return reply.code(400).send({
      error: 'Validation failed',
      code: 400,
      errorId,
      details: error.validation,
    })
  }

  // Handle JWT errors from @fastify/jwt
  if (error.message.includes('expired') || error.message.includes('jwt')) {
    return reply.code(401).send({
      error: 'Invalid or expired token',
      code: 401,
      errorId,
    })
  }

  // Handle Prisma errors with specific error codes
  if (error instanceof PrismaClientKnownRequestError) {
    logger.error('Prisma known error', { code: error.code, meta: error.meta })

    // P2002: Unique constraint violation
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined
      const field = target ? target.join(', ') : 'field'
      return reply.code(409).send({
        error: `A resource with this ${field} already exists`,
        code: 409,
        errorId,
        ...(Config.NODE_ENV === 'development' && { details: error.message }),
      })
    }

    // P2025: Record not found
    if (error.code === 'P2025') {
      return reply.code(404).send({
        error: 'Resource not found',
        code: 404,
        errorId,
      })
    }

    // P2003: Foreign key constraint failed
    if (error.code === 'P2003') {
      return reply.code(400).send({
        error: 'Invalid reference to related resource',
        code: 400,
        errorId,
      })
    }

    // Generic Prisma error
    return reply.code(500).send({
      error: 'Database operation failed',
      code: 500,
      errorId,
      ...(Config.NODE_ENV === 'development' && { details: error.message }),
    })
  }

  // Handle Prisma validation errors
  if (error instanceof PrismaClientValidationError) {
    logger.error('Prisma validation error', error)
    return reply.code(400).send({
      error: 'Invalid data provided',
      code: 400,
      errorId,
      ...(Config.NODE_ENV === 'development' && { details: error.message }),
    })
  }

  // Handle unknown Prisma errors
  if (error instanceof PrismaClientUnknownRequestError) {
    logger.error('Prisma unknown error', error)
    return reply.code(500).send({
      error: 'An unexpected database error occurred',
      code: 500,
      errorId,
      ...(Config.NODE_ENV === 'development' && { details: error.message }),
    })
  }

  // Handle rate limit errors
  if ('statusCode' in error && error.statusCode === 429) {
    return reply.code(429).send({
      error: 'Too many requests',
      code: 429,
      errorId,
    })
  }

  // Generic error response
  const statusCode = 'statusCode' in error && error.statusCode ? error.statusCode : 500
  const response: ErrorResponse = {
    error: Config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: statusCode,
    errorId,
  }

  // Include stack trace in development
  if (Config.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack
  }

  // In production, log the error ID for support
  if (Config.NODE_ENV === 'production') {
    logger.error(`Error ${errorId}: Please provide this error ID to support for assistance`, {})
  }

  return reply.code(statusCode).send(response)
}
