import { Logger } from '@/utils/logger'
import { DatabaseService } from '@/services/database.service'
import { RedisService } from '@/services/redis.service'
import { ServiceHealth } from '@/types'
import { DIContainer } from '@/container'

/**
 * Service Registry - manages service availability and health checks
 * Replaces global mutable state with proper encapsulation
 */
export class ServiceRegistry {
  private logger: Logger
  private health: ServiceHealth
  private healthCheckInterval?: ReturnType<typeof setInterval>
  private databaseService: DatabaseService
  private redisService: RedisService

  constructor(private _container?: DIContainer) {
    this.logger = new Logger('ServiceRegistry')
    this.health = {
      redis: false,
      postgres: false,
    }
    this.databaseService = new DatabaseService()
    this.redisService = new RedisService()
  }

  /**
   * Initialize all services and start health monitoring
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing services...')

    // Initialize Database
    await this.checkPostgres()

    // Initialize Redis
    await this.checkRedis()

    // Start periodic health checks
    this.startHealthChecks()

    this.logger.info('Services initialized')
  }

  /**
   * Check PostgreSQL connection
   */
  private async checkPostgres(): Promise<void> {
    try {
      await this.databaseService.connect()
      this.health.postgres = true
      this.logger.info('✅ PostgreSQL connection established')
    } catch (error) {
      this.health.postgres = false
      this.logger.warn('❌ PostgreSQL is not available - running without database')
    }
  }

  /**
   * Check Redis connection
   */
  private async checkRedis(): Promise<void> {
    try {
      const available = await this.redisService.checkConnection()
      this.health.redis = available
      if (available) {
        this.logger.info('✅ Redis connection available')
      } else {
        this.logger.warn('❌ Redis is not available - running without cache')
      }
    } catch (error) {
      this.health.redis = false
      this.logger.warn('❌ Redis is not available - running without cache')
    }
  }

  /**
   * Start periodic health checks (every 30 seconds)
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      async () => {
        await this.checkPostgres()
        await this.checkRedis()
      },
      30000 // 30 seconds
    )
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Get current service health status
   */
  getHealth(): ServiceHealth {
    return { ...this.health }
  }

  /**
   * Check if PostgreSQL is available
   */
  isPostgresAvailable(): boolean {
    return this.health.postgres
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.health.redis
  }

  /**
   * Get or set DI container
   */
  get container(): DIContainer | undefined {
    return this._container
  }

  set container(container: DIContainer | undefined) {
    this._container = container
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down services...')
    this.stopHealthChecks()

    try {
      await this.databaseService.disconnect()
      await this.redisService.disconnect()
    } catch (error) {
      this.logger.error('Error during service shutdown', error)
    }

    this.logger.info('Services shut down successfully')
  }
}

// Singleton instance
let serviceRegistryInstance: ServiceRegistry | null = null

export function getServiceRegistry(): ServiceRegistry {
  if (!serviceRegistryInstance) {
    serviceRegistryInstance = new ServiceRegistry()
  }
  return serviceRegistryInstance
}

export function setServiceRegistry(registry: ServiceRegistry): void {
  serviceRegistryInstance = registry
}
