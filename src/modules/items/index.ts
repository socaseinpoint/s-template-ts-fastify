/**
 * Items Module - Public API
 *
 * Exports only what's needed by other modules and infrastructure:
 * - Service (for DI container)
 * - Repository interface (for DI and testing)
 * - Repository implementation (for DI container)
 * - Controller (for routes registration)
 * - Key response types (for inter-module communication)
 */

// Service (for DI container)
export { ItemService } from './item.service'

// Repository (for DI container and testing)
export { ItemRepository } from './item.repository'
export type { IItemRepository } from './item.repository'

// Controller (for routes)
export { default as itemController } from './item.controller'

// Public response types (for inter-module communication)
export type { ItemResponseDto } from './item.dto'

// Internal types (request DTOs, schemas, pagination) are NOT exported
// They are HTTP layer implementation details
