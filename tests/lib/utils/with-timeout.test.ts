import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withTimeout } from '@/lib/utils/with-timeout'

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with value when promise resolves before timeout', async () => {
    const promise = withTimeout(Promise.resolve('hello'), 1000, 'timed out')
    await expect(promise).resolves.toBe('hello')
  })

  it('rejects with original error when promise rejects before timeout', async () => {
    const promise = withTimeout(Promise.reject(new Error('original')), 1000, 'timed out')
    await expect(promise).rejects.toThrow('original')
  })

  it('rejects with timeout message when timeout fires first', async () => {
    const neverResolves = new Promise(() => {})
    const promise = withTimeout(neverResolves, 500, 'operation timed out')

    vi.advanceTimersByTime(500)

    await expect(promise).rejects.toThrow('operation timed out')
  })

  it('clears timer on successful resolve (no lingering timer)', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    const promise = withTimeout(Promise.resolve(42), 5000, 'timeout')
    await promise
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('clears timer on rejection (no lingering timer)', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    const promise = withTimeout(Promise.reject(new Error('fail')), 5000, 'timeout')
    await promise.catch(() => {})
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('works with PromiseLike (thenable) objects', async () => {
    const thenable: PromiseLike<string> = {
      then<TResult1 = string, TResult2 = never>(
        onfulfilled?: ((value: string) => TResult1 | PromiseLike<TResult1>) | null | undefined,
        _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
      ): PromiseLike<TResult1 | TResult2> {
        if (onfulfilled) {
          return Promise.resolve(onfulfilled('from thenable'))
        }
        return Promise.resolve('from thenable') as unknown as PromiseLike<TResult1 | TResult2>
      },
    }
    const result = await withTimeout(thenable, 1000, 'timeout')
    expect(result).toBe('from thenable')
  })
})
