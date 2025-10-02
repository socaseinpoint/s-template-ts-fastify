import { UserRole } from '@/types'

export interface TestUser {
  id: string
  email: string
  password: string
  name: string
  role: UserRole
}

export const testUsers = {
  admin: {
    id: '1',
    email: 'admin@example.com',
    password: 'Admin123!',
    name: 'Admin User',
    role: 'admin' as UserRole,
  },
  moderator: {
    id: '2',
    email: 'moderator@example.com',
    password: 'Moderator123!',
    name: 'Moderator User',
    role: 'moderator' as UserRole,
  },
  user: {
    id: '3',
    email: 'user@example.com',
    password: 'User123!',
    name: 'Regular User',
    role: 'user' as UserRole,
  },
}

export const createTestUser = (overrides?: Partial<TestUser>): TestUser => ({
  id: `${Date.now()}`,
  email: `test${Date.now()}@example.com`,
  password: 'TestPass123!',
  name: 'Test User',
  role: 'user' as UserRole,
  ...overrides,
})

export const mockUsers: TestUser[] = [
  testUsers.admin,
  testUsers.moderator,
  testUsers.user,
]

