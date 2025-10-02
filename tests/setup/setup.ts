import { beforeAll, afterAll, afterEach, vi } from 'vitest'

// Override NODE_ENV to test
process.env.NODE_ENV = 'test'

beforeAll(async () => {
  console.log('🧪 Starting test suite...')
  console.log(`📦 Node environment: ${process.env.NODE_ENV}`)
  console.log(`🔧 Test setup loaded`)
})

afterAll(async () => {
  console.log('✅ Test suite finished')
})

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks()
})

// Global test timeout
vi.setConfig({ testTimeout: 10000 })

