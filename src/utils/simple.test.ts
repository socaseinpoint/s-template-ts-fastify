import { describe, it, expect } from 'vitest'

describe('Simple Test', () => {
  it('should pass basic math test', () => {
    expect(2 + 2).toBe(4)
  })

  it('should work with async', async () => {
    const promise = Promise.resolve(42)
    await expect(promise).resolves.toBe(42)
  })
})
