import { describe, it, expect } from 'vitest'
import {
  PUBLIC_PATHS,
  matchesPath,
  isPublicPath,
  needsPhoneCompletion,
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

  describe('needsPhoneCompletion', () => {
    const base = {
      role: 'VOLUNTEER',
      status: 'ACTIVE' as const,
      phoneNumber: null,
      pathname: '/home',
    }

    it('redirects an active volunteer without a phone', () => {
      expect(needsPhoneCompletion(base)).toBe(true)
    })

    it('treats a whitespace-only phone as missing', () => {
      expect(needsPhoneCompletion({ ...base, phoneNumber: '   ' })).toBe(true)
    })

    it('allows an active volunteer with a phone', () => {
      expect(needsPhoneCompletion({ ...base, phoneNumber: '+6591234567' })).toBe(false)
    })

    it('allows the profile page itself to avoid a redirect loop', () => {
      expect(needsPhoneCompletion({ ...base, pathname: '/profile' })).toBe(false)
    })

    it('exempts admins', () => {
      expect(needsPhoneCompletion({ ...base, role: 'ADMIN' })).toBe(false)
    })

    it('exempts non-active users', () => {
      expect(needsPhoneCompletion({ ...base, status: 'PENDING' })).toBe(false)
    })

    it('exempts API routes so background sync can finish', () => {
      expect(needsPhoneCompletion({ ...base, pathname: '/api/offline-sync' })).toBe(false)
    })
  })
})
