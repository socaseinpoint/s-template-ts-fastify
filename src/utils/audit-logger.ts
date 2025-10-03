import { Logger } from '@/utils/logger'
import { Config } from '@/config'

const logger = new Logger('Audit')

export interface AuditEvent {
  action: string
  userId?: string
  email?: string
  ip?: string
  userAgent?: string
  success: boolean
  reason?: string
  metadata?: Record<string, unknown>
}

/**
 * AuditLogger - Security and compliance event logging
 *
 * Logs important security events for audit trails:
 * - Authentication attempts (login, logout, registration)
 * - Authorization failures
 * - Password changes
 * - Account modifications
 * - Data access (for sensitive resources)
 *
 * In production, these logs should be sent to a SIEM or log aggregation service
 */
export class AuditLogger {
  /**
   * Log a security-related event
   */
  static logSecurityEvent(event: AuditEvent): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_AUDIT',
      ...event,
    }

    // Log at INFO level for successful events, WARN for failures
    if (event.success) {
      logger.info('Security Event', auditEntry)
    } else {
      logger.warn('Security Event FAILED', auditEntry)
    }

    // In production, send to external audit service
    if (Config.NODE_ENV === 'production') {
      // TODO: Send to SIEM, CloudWatch, Datadog, etc.
      // Example: await sendToAuditService(auditEntry)
    }
  }

  /**
   * Log authentication attempt
   */
  static logAuth(params: {
    action: 'login' | 'register' | 'logout' | 'refresh_token'
    email?: string
    userId?: string
    ip: string
    userAgent?: string
    success: boolean
    reason?: string
  }): void {
    this.logSecurityEvent({
      action: `AUTH_${params.action.toUpperCase()}`,
      email: params.email,
      userId: params.userId,
      ip: params.ip,
      userAgent: params.userAgent,
      success: params.success,
      reason: params.reason,
    })
  }

  /**
   * Log authorization failure
   */
  static logAuthorizationFailure(params: {
    userId: string
    action: string
    resource: string
    requiredRole?: string
    currentRole?: string
    ip: string
  }): void {
    this.logSecurityEvent({
      action: 'AUTHORIZATION_DENIED',
      userId: params.userId,
      ip: params.ip,
      success: false,
      metadata: {
        action: params.action,
        resource: params.resource,
        requiredRole: params.requiredRole,
        currentRole: params.currentRole,
      },
    })
  }

  /**
   * Log sensitive data access
   */
  static logDataAccess(params: {
    userId: string
    action: 'read' | 'write' | 'delete'
    resource: string
    resourceId: string
    ip: string
  }): void {
    this.logSecurityEvent({
      action: `DATA_${params.action.toUpperCase()}`,
      userId: params.userId,
      ip: params.ip,
      success: true,
      metadata: {
        resource: params.resource,
        resourceId: params.resourceId,
      },
    })
  }

  /**
   * Log password change
   */
  static logPasswordChange(params: {
    userId: string
    email: string
    ip: string
    success: boolean
  }): void {
    this.logSecurityEvent({
      action: 'PASSWORD_CHANGE',
      userId: params.userId,
      email: params.email,
      ip: params.ip,
      success: params.success,
    })
  }

  /**
   * Log account modification
   */
  static logAccountModification(params: {
    userId: string
    modifiedBy: string
    changes: string[]
    ip: string
  }): void {
    this.logSecurityEvent({
      action: 'ACCOUNT_MODIFIED',
      userId: params.userId,
      ip: params.ip,
      success: true,
      metadata: {
        modifiedBy: params.modifiedBy,
        changes: params.changes,
      },
    })
  }

  /**
   * Log suspicious activity
   */
  static logSuspiciousActivity(params: {
    userId?: string
    ip: string
    action: string
    reason: string
    metadata?: Record<string, unknown>
  }): void {
    this.logSecurityEvent({
      action: 'SUSPICIOUS_ACTIVITY',
      userId: params.userId,
      ip: params.ip,
      success: false,
      reason: params.reason,
      metadata: {
        suspiciousAction: params.action,
        ...params.metadata,
      },
    })

    // In production, trigger alerts for suspicious activity
    if (Config.NODE_ENV === 'production') {
      // TODO: Send alert to security team
      logger.error('🚨 SUSPICIOUS ACTIVITY DETECTED', params)
    }
  }
}
