export const PUBLIC_PATHS = ['/login', '/auth/callback', '/pending', '/blocked'] as const

export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'DISABLED'

export function matchesPath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`)
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => matchesPath(pathname, path))
}

export function needsProfileCheck({
  hasUser,
  pathname,
  isPublic,
}: {
  hasUser: boolean
  pathname: string
  isPublic: boolean
}): boolean {
  return hasUser && pathname !== '/' && (!isPublic || pathname === '/pending' || pathname === '/blocked')
}

export function resolveStatusRedirect(status: UserStatus): '/pending' | '/blocked' | null {
  if (status === 'PENDING') return '/pending'
  if (status === 'REJECTED' || status === 'DISABLED') return '/blocked'
  return null
}
