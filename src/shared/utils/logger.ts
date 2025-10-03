import { Config } from '@/config'

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private context: string
  private logLevel: LogLevel

  constructor(context: string) {
    this.context = context
    this.logLevel = this.parseLogLevel(Config.LOG_LEVEL)
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error':
        return LogLevel.ERROR
      case 'warn':
        return LogLevel.WARN
      case 'info':
        return LogLevel.INFO
      case 'debug':
        return LogLevel.DEBUG
      default:
        return LogLevel.INFO
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level}] [${this.context}] ${message}`
  }

  error(message: string, error?: unknown): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message))
      if (error) {
        if (error instanceof Error) {
          console.error(`  Stack: ${error.stack}`)
        } else {
          console.error(`  Details: ${JSON.stringify(error)}`)
        }
      }
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message))
      if (data) {
        console.warn(`  Data: ${JSON.stringify(data)}`)
      }
    }
  }

  info(message: string, data?: unknown): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message))
      if (data) {
        console.info(`  Data: ${JSON.stringify(data)}`)
      }
    }
  }

  debug(message: string): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message))
    }
  }

  log(message: string): void {
    this.info(message)
  }
}
