export interface ViewExportMediaPathInput {
  roundName?: string | null
  walkDate?: string | null
  locationName?: string | null
  userName?: string | null
  userFallback?: string | null
  userId?: string | null
  species?: string | null
  count?: number | null
  sightingId?: string | null
  fileName?: string | null
}

const INVALID_SEGMENT_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g
const ROUND_MAX = 24
const WALK_MAX = 36
const USER_MAX = 24
const LEAF_MAX = 20
const FILE_MAX = 48

export function sanitizePathSegment(value: string | null | undefined, fallback: string): string {
  const sanitized = (value ?? '')
    .replace(INVALID_SEGMENT_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  return sanitized || fallback
}

function truncateSegment(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return value.slice(0, maxLength).trim().replace(/[. ]+$/g, '')
}

function shortenFileName(fileName: string, maxLength: number): string {
  if (fileName.length <= maxLength) return fileName

  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0) {
    return truncateSegment(fileName, maxLength)
  }

  const ext = fileName.slice(dotIndex)
  const base = fileName.slice(0, dotIndex)
  const baseMax = Math.max(1, maxLength - ext.length)
  return `${truncateSegment(base, baseMax)}${ext}`
}

export function buildWalkFolderName(walkDate?: string | null, locationName?: string | null): string {
  const date = sanitizePathSegment(walkDate, 'Unknown Date')
  const location = sanitizePathSegment(locationName, 'Unknown Walk')
  return truncateSegment(`${date} - ${location}`, WALK_MAX)
}

export function buildUserFolderName(input: Pick<ViewExportMediaPathInput, 'userName' | 'userFallback' | 'userId'>): string {
  return truncateSegment(
    sanitizePathSegment(
      input.userName || input.userFallback || input.userId,
      'Unknown User'
    ),
    USER_MAX
  )
}

export function buildMediaLeafFolderName(input: Pick<ViewExportMediaPathInput, 'species' | 'count' | 'sightingId'>): string {
  if (!input.sightingId) {
    return 'obs'
  }

  const species = sanitizePathSegment(input.species, 'Unknown Species')
  const count = input.count ?? '?'
  return truncateSegment(`sg-${species}-${count}`, LEAF_MAX)
}

export function uniquifyZipPath(
  desiredPath: string,
  usedPaths: Set<string>
): string {
  if (!usedPaths.has(desiredPath)) {
    usedPaths.add(desiredPath)
    return desiredPath
  }

  const lastSlash = desiredPath.lastIndexOf('/')
  const dir = lastSlash >= 0 ? desiredPath.slice(0, lastSlash) : ''
  const name = lastSlash >= 0 ? desiredPath.slice(lastSlash + 1) : desiredPath
  const extIndex = name.lastIndexOf('.')
  const base = extIndex > 0 ? name.slice(0, extIndex) : name
  const ext = extIndex > 0 ? name.slice(extIndex) : ''

  let attempt = 2
  while (true) {
    const candidateName = `${base} (${attempt})${ext}`
    const candidate = dir ? `${dir}/${candidateName}` : candidateName
    if (!usedPaths.has(candidate)) {
      usedPaths.add(candidate)
      return candidate
    }
    attempt += 1
  }
}

export function buildReadableMediaPath(
  input: ViewExportMediaPathInput,
  usedPaths: Set<string>
): string {
  const round = truncateSegment(sanitizePathSegment(input.roundName, 'Unknown Round'), ROUND_MAX)
  const walk = buildWalkFolderName(input.walkDate, input.locationName)
  const user = buildUserFolderName(input)
  const leaf = buildMediaLeafFolderName(input)
  const fileName = shortenFileName(sanitizePathSegment(input.fileName, 'unnamed-file'), FILE_MAX)
  return uniquifyZipPath(`media/${round}/${walk}/${user}/${leaf}/${fileName}`, usedPaths)
}
