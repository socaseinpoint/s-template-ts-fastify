export const Config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  
  // API Keys
  API_KEY: process.env.API_KEY || '',
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Service specific configuration
  SERVICE_NAME: process.env.SERVICE_NAME || 'fastify-service',
  SERVICE_VERSION: process.env.SERVICE_VERSION || '1.0.0',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Feature flags
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  ENABLE_HEALTH_CHECK: process.env.ENABLE_HEALTH_CHECK !== 'false',
  ENABLE_SWAGGER: process.env.ENABLE_SWAGGER !== 'false',
} as const

export type ConfigType = typeof Config
