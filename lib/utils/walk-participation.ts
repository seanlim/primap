export interface JoinBlockInfo {
  label: string
  description: string
}

export function getWalkStartDateTime(walkDate: string, startTime: string) {
  return new Date(`${walkDate}T${startTime}`)
}

export function getWalkEndDateTime(walkDate: string, endTime: string) {
  return new Date(`${walkDate}T${endTime}`)
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
