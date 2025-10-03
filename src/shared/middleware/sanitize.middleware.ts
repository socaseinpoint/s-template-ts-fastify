import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import { Logger } from '@/shared/utils/logger'

const logger = new Logger('SanitizeMiddleware')

/**
 * Input Sanitization Middleware (Optional)
 *
 * IMPORTANT: This middleware is OPTIONAL because:
 * 1. Zod already validates types, formats, and constraints
 * 2. Prisma provides parameterized queries (SQL injection protection)
 * 3. Response serialization via Zod prevents XSS
 *
 * Use this middleware only if you need additional sanitization for:
 * - User-generated content (comments, descriptions)
 * - Search queries
 * - Rich text fields
 *
 * To enable: Add to specific routes or globally in app.ts
 * Example: fastify.addHook('preHandler', sanitizeInput)
 */

/**
 * Sanitize a string value
 * - Trim whitespace
 * - Remove potentially dangerous characters
 * - Limit length
 */
function sanitizeString(value: string, maxLength = 10000): string {
  return (
    value
      .trim()
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters (except newlines/tabs)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Limit length
      .slice(0, maxLength)
  )
}

/**
 * Sanitize an object recursively
 */
function sanitizeObject(obj: any, depth = 0, maxDepth = 10): any {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    logger.warn('Maximum sanitization depth reached')
    return obj
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1, maxDepth))
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, depth + 1, maxDepth)
    }
    return sanitized
  }

  return obj
}

/**
 * Sanitize request body, query, and params
 */
export async function sanitizeInput(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): Promise<void> {
  try {
    // Sanitize body
    if (request.body && typeof request.body === 'object') {
      request.body = sanitizeObject(request.body)
    }

    // Sanitize query parameters
    if (request.query && typeof request.query === 'object') {
      request.query = sanitizeObject(request.query)
    }

    // Sanitize route params
    if (request.params && typeof request.params === 'object') {
      request.params = sanitizeObject(request.params)
    }

    done()
  } catch (error) {
    logger.error('Error during input sanitization', error)
    // Continue without sanitization rather than breaking the request
    done()
  }
}

/**
 * Aggressive sanitization for rich text/HTML content
 * Use for user-generated content that may contain HTML
 */
export function sanitizeHtml(html: string): string {
  return (
    html
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Trim
      .trim()
  )
}

/**
 * Sanitize search query
 * Removes special characters that could cause issues
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/['"]/g, '') // Remove quotes
    .slice(0, 200) // Limit search query length
}
