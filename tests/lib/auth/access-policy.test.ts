import { describe, it, expect } from 'vitest'
import {
  PUBLIC_PATHS,
  matchesPath,
  isPublicPath,
  needsProfileCheck,
  resolveStatusRedirect,
} from '@/lib/auth/access-policy'

describe('access-policy', () => {
  describe('matchesPath', () => {
    it('returns true for exact match', () => {
      expect(matchesPath('/login', '/login')).toBe(true)
    })

    it('returns true for sub-path with slash separator', () => {
      expect(matchesPath('/login/extra', '/login')).toBe(true)
    })

    it('returns false for prefix without slash separator', () => {
      expect(matchesPath('/loginextra', '/login')).toBe(false)
    })

    it('returns false when pathname does not start with basePath', () => {
      expect(matchesPath('/', '/login')).toBe(false)
    })

    it('returns false for partial base match', () => {
      expect(matchesPath('/login', '/log')).toBe(false)
    })

    it('returns true for deeply nested sub-path', () => {
      expect(matchesPath('/auth/callback/extra/deep', '/auth/callback')).toBe(true)
    })
  })

  describe('isPublicPath', () => {
    it.each(PUBLIC_PATHS)('returns true for public path "%s"', (path) => {
      expect(isPublicPath(path)).toBe(true)
    })

    it('returns true for sub-path of public path', () => {
      expect(isPublicPath('/auth/callback/extra')).toBe(true)
    })

    it('returns false for root path', () => {
      expect(isPublicPath('/')).toBe(false)
    })

    it('returns false for /home', () => {
      expect(isPublicPath('/home')).toBe(false)
    })

    it('returns false for /admin', () => {
      expect(isPublicPath('/admin')).toBe(false)
    })

    it('returns false for /walk', () => {
      expect(isPublicPath('/walk')).toBe(false)
    })

    it('returns false for path that starts with public path prefix but no slash', () => {
      expect(isPublicPath('/logins')).toBe(false)
    })
  })

  describe('needsProfileCheck', () => {
    it('returns false when no user', () => {
      expect(needsProfileCheck({ hasUser: false, pathname: '/home', isPublic: false })).toBe(false)
    })

    it('returns false for root path even with user', () => {
      expect(needsProfileCheck({ hasUser: true, pathname: '/', isPublic: false })).toBe(false)
    })

    it('returns true for protected page with user', () => {
      expect(needsProfileCheck({ hasUser: true, pathname: '/home', isPublic: false })).toBe(true)
    })

    it('returns false for public non-status page with user', () => {
      expect(needsProfileCheck({ hasUser: true, pathname: '/login', isPublic: true })).toBe(false)
    })

    it('returns true for /pending even though it is public', () => {
      expect(needsProfileCheck({ hasUser: true, pathname: '/pending', isPublic: true })).toBe(true)
    })

    it('returns true for /blocked even though it is public', () => {
      expect(needsProfileCheck({ hasUser: true, pathname: '/blocked', isPublic: true })).toBe(true)
    })

    it('returns true for /admin with user', () => {
      expect(needsProfileCheck({ hasUser: true, pathname: '/admin', isPublic: false })).toBe(true)
    })

    it('returns false for /auth/callback (public, not status page)', () => {
      expect(needsProfileCheck({ hasUser: true, pathname: '/auth/callback', isPublic: true })).toBe(false)
    })
  })

  describe('resolveStatusRedirect', () => {
    it('returns /pending for PENDING status', () => {
      expect(resolveStatusRedirect('PENDING')).toBe('/pending')
    })

    it('returns /blocked for REJECTED status', () => {
      expect(resolveStatusRedirect('REJECTED')).toBe('/blocked')
    })

    it('returns /blocked for DISABLED status', () => {
      expect(resolveStatusRedirect('DISABLED')).toBe('/blocked')
    })

    it('returns null for ACTIVE status', () => {
      expect(resolveStatusRedirect('ACTIVE')).toBeNull()
    })
  })
})
