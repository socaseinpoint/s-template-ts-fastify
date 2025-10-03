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
  // Global rate limit
  GLOBAL: {
    MAX: process.env.NODE_ENV === 'test' ? 10000 : 100,
    TIMEWINDOW: 60000, // 1 minute
    BAN: process.env.NODE_ENV === 'test' ? 100 : 5,
  },
  // Auth endpoints - more strict
  AUTH_LOGIN: {
    MAX: process.env.NODE_ENV === 'test' ? 1000 : 5, // 5 attempts per 15 minutes
    TIMEWINDOW: 15 * 60000, // 15 minutes
    BAN: process.env.NODE_ENV === 'test' ? 100 : 3, // Ban after 3 violations
  },
  AUTH_REGISTER: {
    MAX: process.env.NODE_ENV === 'test' ? 1000 : 3, // 3 registrations per hour per IP
    TIMEWINDOW: 60 * 60000, // 1 hour
    BAN: process.env.NODE_ENV === 'test' ? 100 : 2,
  },
  AUTH_REFRESH: {
    MAX: process.env.NODE_ENV === 'test' ? 1000 : 10, // 10 refreshes per hour
    TIMEWINDOW: 60 * 60000, // 1 hour
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
  NOT_CONFIGURED = 'not_configured',
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
