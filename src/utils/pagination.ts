/**
 * Pagination metadata
 * FIXED: No more raw arrays - always include pagination info
 */
export interface PaginationMetadata {
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMetadata
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  currentPage: number,
  pageSize: number,
  totalCount: number
): PaginationMetadata {
  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  }
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  currentPage: number,
  pageSize: number,
  totalCount: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: calculatePagination(currentPage, pageSize, totalCount),
  }
}

/**
 * Calculate skip and take for database queries
 */
export function getPaginationParams(page: number = 1, limit: number = 10): { skip: number; take: number } {
  // Ensure positive values
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, Math.min(100, limit)) // Max 100 items per page

  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  }
}

/**
 * Parse pagination query params
 */
export interface PaginationQuery {
  page?: number
  limit?: number
}

export function parsePaginationQuery(query: Record<string, unknown>): { page: number; limit: number } {
  const page = typeof query.page === 'number' ? query.page : typeof query.page === 'string' ? parseInt(query.page, 10) : 1
  const limit =
    typeof query.limit === 'number' ? query.limit : typeof query.limit === 'string' ? parseInt(query.limit, 10) : 10

  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)),
  }
}

