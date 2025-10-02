import { FastifyInstance } from 'fastify'
import { testUsers } from '../fixtures/users.fixture'

/**
 * Helper to login and get access token
 */
export async function getAuthToken(
  server: FastifyInstance,
  email: string = testUsers.admin.email,
  password: string = testUsers.admin.password
): Promise<string> {
  const response = await server.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  })

  const data = JSON.parse(response.body)
  return data.accessToken
}

/**
 * Helper to create authorization header
 */
export function createAuthHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Helper to wait for a specific time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Helper to generate unique email
 */
export function generateUniqueEmail(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`
}

/**
 * Helper to clean sensitive data from objects
 */
export function cleanSensitiveData<T extends Record<string, any>>(
  obj: T,
  keysToRemove: string[] = ['password', 'refreshToken']
): Partial<T> {
  const cleaned = { ...obj }
  keysToRemove.forEach((key) => {
    delete cleaned[key]
  })
  return cleaned
}

/**
 * Helper to compare objects ignoring specific fields
 */
export function compareObjects<T extends Record<string, any>>(
  obj1: T,
  obj2: T,
  ignoreFields: string[] = ['id', 'createdAt', 'updatedAt']
): boolean {
  const clean1 = { ...obj1 }
  const clean2 = { ...obj2 }

  ignoreFields.forEach((field) => {
    delete clean1[field]
    delete clean2[field]
  })

  return JSON.stringify(clean1) === JSON.stringify(clean2)
}

