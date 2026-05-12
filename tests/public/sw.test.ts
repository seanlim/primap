import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('public service worker', () => {
  const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')

  it('bumps the primap cache version when changing cache behavior', () => {
    expect(source).toContain("const CACHE_NAME = 'primap-v3'")
  })

  it('does not intercept localhost fetches', () => {
    expect(source).toContain('const IS_LOCALHOST = LOCAL_HOSTNAMES.has(self.location.hostname)')
    expect(source).toContain('if (IS_LOCALHOST) return')
  })

  it('clears old primap caches during activation', () => {
    expect(source).toContain("key.startsWith('primap-')")
  })
})
