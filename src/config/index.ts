export const Config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || '',
  
  // API Keys
  API_KEY: process.env.API_KEY || '',
  
  // Service specific configuration
  SERVICE_NAME: process.env.SERVICE_NAME || 'ts-service',
  SERVICE_VERSION: process.env.SERVICE_VERSION || '1.0.0',
  
  // Feature flags
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  ENABLE_HEALTH_CHECK: process.env.ENABLE_HEALTH_CHECK !== 'false',
} as const

export type ConfigType = typeof Config
