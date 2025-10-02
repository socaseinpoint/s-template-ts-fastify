import { describe, it, expect } from 'vitest'
import { sleep, retry, deepClone, isEmpty, randomString, chunk } from '@/utils/helpers'

describe('Helpers', () => {
  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now()
      await sleep(100)
      const end = Date.now()
      expect(end - start).toBeGreaterThanOrEqual(90) // Allow some tolerance
    })
  })

  describe('retry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0
      const fn = async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Failed')
        }
        return 'success'
      }

      const result = await retry(fn, 3, 10)
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('should throw after max retries', async () => {
      const fn = async () => {
        throw new Error('Always fails')
      }

      await expect(retry(fn, 2, 10)).rejects.toThrow('Always fails')
    })
  })

  describe('deepClone', () => {
    it('should clone nested objects', () => {
      const obj = {
        a: 1,
        b: { c: 2, d: [3, 4] },
        e: new Date(),
      }

      const cloned = deepClone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.b).not.toBe(obj.b)
      expect(cloned.b.d).not.toBe(obj.b.d)
    })

    it('should handle null and primitives', () => {
      expect(deepClone(null)).toBe(null)
      expect(deepClone(5)).toBe(5)
      expect(deepClone('test')).toBe('test')
      expect(deepClone(true)).toBe(true)
    })
  })

  describe('isEmpty', () => {
    it('should identify empty values', () => {
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
      expect(isEmpty('')).toBe(true)
      expect(isEmpty('  ')).toBe(true)
      expect(isEmpty([])).toBe(true)
      expect(isEmpty({})).toBe(true)
    })

    it('should identify non-empty values', () => {
      expect(isEmpty('test')).toBe(false)
      expect(isEmpty([1])).toBe(false)
      expect(isEmpty({ a: 1 })).toBe(false)
      expect(isEmpty(0)).toBe(false)
      expect(isEmpty(false)).toBe(false)
    })
  })

  describe('randomString', () => {
    it('should generate random strings', () => {
      const str1 = randomString(10)
      const str2 = randomString(10)
      
      expect(str1).toHaveLength(10)
      expect(str2).toHaveLength(10)
      expect(str1).not.toBe(str2)
    })

    it('should use default length', () => {
      const str = randomString()
      expect(str).toHaveLength(10)
    })
  })

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7]
      const chunks = chunk(arr, 3)
      
      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    })

    it('should handle empty array', () => {
      expect(chunk([], 3)).toEqual([])
    })
  })
})

