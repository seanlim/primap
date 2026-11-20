import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('public service worker', () => {
  const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')

  it('bumps the primap cache version when changing cache behavior', () => {
    expect(source).toContain("const CACHE_NAME = 'primap-static-v1'")
  })

  it('does not intercept localhost fetches', () => {
    expect(source).toContain('const IS_LOCALHOST = LOCAL_HOSTNAMES.has(self.location.hostname)')
    expect(source).toContain('if (IS_LOCALHOST) return')
  })

  it('clears old primap caches during activation', () => {
    expect(source).toContain("key.startsWith('primap-')")
  })

  it('does not precache per-user app routes on install', () => {
    expect(source).not.toContain('cache.addAll')
    expect(source).not.toContain('STATIC_ASSETS')
    for (const route of ['/home', '/walk', '/report', '/profile']) {
      expect(source).not.toContain(`'${route}'`)
    }
  })

  it('never caches documents, RSC payloads or API responses', () => {
    expect(source).toContain("url.searchParams.has('_rsc')")
    expect(source).not.toContain("url.pathname.startsWith('/api/')")
    expect(source).not.toContain('network-first with cache fallback')
  })

  it('only caches content-hashed build assets', () => {
    expect(source).toContain('isImmutableAsset(url)')
    expect(source).toContain("url.pathname.startsWith('/_next/static/')")
  })
})
