// HTTP Routes
export const ROUTES = {
  ROOT: '/',
  HEALTH: '/health',
  DOCS: '/docs',
  DOCS_JSON: '/docs/json',
  DOCS_YAML: '/docs/yaml',
  DOCS_STATIC: '/docs/static',
  AUTH: '/auth',
  WEBHOOK: '/webhook',
  USERS: '/users',
  ITEMS: '/items',
} as const

// Auth
export const AUTH = {
  BEARER_PREFIX: 'Bearer ',
  HEADER_NAME: 'authorization',
} as const

// Rate Limiting
export const RATE_LIMITS = {
  AUTH: {
    MAX: process.env.NODE_ENV === 'test' ? 1000 : 5, // Much higher in tests
    TIMEWINDOW: 60000, // 1 minute
    BAN: process.env.NODE_ENV === 'test' ? 100 : 3, // Higher ban threshold in tests
  },
  GLOBAL: {
    MAX: process.env.NODE_ENV === 'test' ? 10000 : 100,
    TIMEWINDOW: 60000,
    BAN: process.env.NODE_ENV === 'test' ? 100 : 5,
  },
} as const

// Token Types
export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const

// User Roles
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
}

// Service Status
export enum ServiceStatus {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  DEGRADED = 'degraded',
}

// Public routes that don't require authentication
export const PUBLIC_ROUTES = [
  ROUTES.HEALTH,
  ROUTES.DOCS,
  ROUTES.AUTH,
  ROUTES.WEBHOOK,
  ROUTES.DOCS_JSON,
  ROUTES.DOCS_YAML,
  ROUTES.DOCS_STATIC,
  ROUTES.ROOT,
] as const

// Health check intervals
export const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
