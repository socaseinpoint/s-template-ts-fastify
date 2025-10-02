import http from 'http'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'

export interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  service: string
  version: string
  uptime: number
  checks: {
    [key: string]: {
      status: 'ok' | 'error'
      message?: string
    }
  }
}

export class HealthService {
  private logger: Logger
  private server: http.Server | null = null
  private startTime: Date

  constructor() {
    this.logger = new Logger('HealthService')
    this.startTime = new Date()
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing health service...')
    // Add any initialization logic here
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down health service...')
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve())
      })
    }
  }

  async startHealthCheckServer(): Promise<void> {
    const port = Config.PORT + 1 // Health check on different port

    this.server = http.createServer(async (req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        const status = await this.getHealthStatus()
        const statusCode = status.status === 'healthy' ? 200 : 503

        res.writeHead(statusCode, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(status))
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      }
    })

    this.server.listen(port, () => {
      this.logger.info(`Health check server listening on port ${port}`)
    })
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {}

    // Example health checks
    checks.memory = this.checkMemoryUsage()
    checks.database = await this.checkDatabase()
    checks.redis = await this.checkRedis()

    const allChecksOk = Object.values(checks).every(check => check.status === 'ok')

    return {
      status: allChecksOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: Config.SERVICE_NAME,
      version: Config.SERVICE_VERSION,
      uptime: Date.now() - this.startTime.getTime(),
      checks,
    }
  }

  private checkMemoryUsage(): { status: 'ok' | 'error'; message?: string } {
    const usage = process.memoryUsage()
    const heapUsedMB = usage.heapUsed / 1024 / 1024
    const heapTotalMB = usage.heapTotal / 1024 / 1024
    const percentage = (heapUsedMB / heapTotalMB) * 100

    if (percentage > 90) {
      return {
        status: 'error',
        message: `Memory usage is high: ${percentage.toFixed(2)}%`,
      }
    }

    return {
      status: 'ok',
      message: `Memory usage: ${percentage.toFixed(2)}%`,
    }
  }

  private async checkDatabase(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    // Implement your database health check here
    if (!Config.DATABASE_URL) {
      return {
        status: 'ok',
        message: 'Database not configured',
      }
    }

    try {
      // Example: await db.ping()
      return {
        status: 'ok',
        message: 'Database connection healthy',
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Database connection failed: ${error}`,
      }
    }
  }

  private async checkRedis(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    // Implement your Redis health check here
    if (!Config.REDIS_URL) {
      return {
        status: 'ok',
        message: 'Redis not configured',
      }
    }

    try {
      // Example: await redis.ping()
      return {
        status: 'ok',
        message: 'Redis connection healthy',
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Redis connection failed: ${error}`,
      }
    }
  }
}
