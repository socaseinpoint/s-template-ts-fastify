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
