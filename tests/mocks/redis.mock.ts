import { vi } from 'vitest'

export const createRedisMock = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-1),
  keys: vi.fn().mockResolvedValue([]),
  flushall: vi.fn().mockResolvedValue('OK'),
  ping: vi.fn().mockResolvedValue('PONG'),
})

export const RedisServiceMock = vi.fn().mockImplementation(() => createRedisMock())

