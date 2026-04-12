export interface JoinBlockInfo {
  label: string
  description: string
}

export const APP_TIME_ZONE = 'Asia/Singapore'
export const APP_TIME_ZONE_OFFSET = '+08:00'

function parseAppDateTime(date: string, time: string) {
  return new Date(`${date}T${time}${APP_TIME_ZONE_OFFSET}`)
}

export function getAppDateString(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function getWalkStartDateTime(walkDate: string, startTime: string) {
  return parseAppDateTime(walkDate, startTime)
}

export function getWalkEndDateTime(walkDate: string, endTime: string) {
  return parseAppDateTime(walkDate, endTime)
}

export function hasWalkStarted(walkDate: string, startTime: string, now = new Date()) {
  return getWalkStartDateTime(walkDate, startTime) <= now
}

export function hasWalkEnded(walkDate: string, endTime: string, now = new Date()) {
  return getWalkEndDateTime(walkDate, endTime) <= now
}

export function getJoinBlockInfo(input: {
  roundStatus?: string | null
  hasStarted: boolean
  isFull: boolean
}): JoinBlockInfo | null {
  if (input.roundStatus !== 'OPEN') {
    return {
      label: 'Round Closed',
      description: 'This survey round is no longer open for volunteer signup.',
    }
  }

  if (input.hasStarted) {
    return {
      label: 'Walk Started',
      description: 'This walk has already started or passed and can no longer be joined.',
    }
  }

  if (input.isFull) {
    return {
      label: 'Walk Full',
      description: 'This walk has reached its volunteer limit.',
    }
  }

  return null
}
