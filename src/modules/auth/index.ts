/**
 * Auth Module - Public API
 * 
 * Exports only what's needed by other modules and infrastructure:
 * - Service (for DI container)
 * - Controller (for routes registration)
 * - Key types (for inter-module communication)
 * 
 * Internal details (schemas, DTOs, etc.) are NOT exported
 */

// Service (for DI container)
export { AuthService } from './auth.service'

// Controller (for routes)
export { default as authController } from './auth.controller'

// Public types (only if needed by other modules)
// Note: Most DTOs are internal HTTP details and should NOT be exported
export type { AuthResponse } from './auth.dto'

