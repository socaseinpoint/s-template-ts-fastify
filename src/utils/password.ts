import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

export class PasswordUtils {
  /**
   * Hash a plain text password
   */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  /**
   * Compare a plain text password with a hashed password
   */
  static async compare(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  /**
   * Validate password strength
   */
  static validateStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
