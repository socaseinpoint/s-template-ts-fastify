import { vi } from 'vitest'
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>()

// Mock the prisma service module
vi.mock('@/services/prisma.service', () => ({
  default: prismaMock,
  __esModule: true,
}))

// Helper to reset mocks
export function resetPrismaMock() {
  mockReset(prismaMock)
}

export type MockPrismaClient = DeepMockProxy<PrismaClient>
