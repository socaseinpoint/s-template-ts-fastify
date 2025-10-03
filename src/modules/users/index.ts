/**
 * Users Module - Public API
 *
 * Exports only what's needed by other modules and infrastructure:
 * - Service (for DI container)
 * - Repository interface (for DI and testing)
 * - Repository implementation (for DI container)
 * - Controller (for routes registration)
 * - Key response types (for inter-module communication)
 */

// Service (for DI container)
export { UserService } from './user.service'

// Repository (for DI container and testing)
export { UserRepository } from './user.repository'
export type { IUserRepository } from './user.repository'

// Controller (for routes)
export { default as userController } from './user.controller'

// Public response types (for inter-module communication)
export type { UserResponseDto } from './user.dto'

// Internal types (request DTOs, schemas) are NOT exported
// They are HTTP layer implementation details
