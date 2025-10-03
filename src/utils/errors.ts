export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly details?: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, statusCode = 500, isOperational = true, details?: any) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.details = details

    Object.setPrototypeOf(this, AppError.prototype)
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, statusCode = 400, details?: any) {
    super(message, statusCode, true, details)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class InternalServerError extends AppError {
  constructor(message: string) {
    super(message, 500)
  }
}

/**
 * Business logic violation
 * Use when business rules are violated (e.g., negative quantity, invalid state transitions)
 */
export class BusinessError extends AppError {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(message: string, details?: any) {
    super(message, 400, true, details)
  }
}

/**
 * Resource already exists
 * Use when trying to create a resource that already exists
 */
export class AlreadyExistsError extends AppError {
  constructor(resource: string, field?: string) {
    const msg = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`
    super(msg, 409)
  }
}

/**
 * Invalid operation for current state
 * Use when an operation cannot be performed due to current state
 */
export class InvalidStateError extends AppError {
  constructor(message: string, currentState?: string) {
    super(message, 400, true, currentState ? { currentState } : undefined)
  }
}

/**
 * Rate limit exceeded
 * Use when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, true, retryAfter ? { retryAfter } : undefined)
  }
}
