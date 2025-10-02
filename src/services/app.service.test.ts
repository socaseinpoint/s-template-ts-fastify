import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AppService } from './app.service'

describe('AppService', () => {
  let appService: AppService

  beforeEach(() => {
    appService = new AppService()
  })

  afterEach(async () => {
    await appService.stop()
  })

  describe('start', () => {
    it('should start the service successfully', async () => {
      await expect(appService.start()).resolves.not.toThrow()
    })

    it('should not start if already running', async () => {
      await appService.start()
      const spy = vi.spyOn(console, 'warn')
      await appService.start()
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('stop', () => {
    it('should stop the service successfully', async () => {
      await appService.start()
      await expect(appService.stop()).resolves.not.toThrow()
    })

    it('should not stop if not running', async () => {
      const spy = vi.spyOn(console, 'warn')
      await appService.stop()
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })
})
