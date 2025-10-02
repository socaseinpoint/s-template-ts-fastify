import { vi } from 'vitest'

export const createDatabaseMock = () => ({
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  execute: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  transaction: vi.fn().mockImplementation(async (callback) => {
    return callback({
      query: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    })
  }),
})

export const DatabaseServiceMock = vi.fn().mockImplementation(() => createDatabaseMock())

