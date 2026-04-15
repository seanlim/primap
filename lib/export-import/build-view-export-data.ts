import { INCIDENT_MEDIA_BUCKET, OBSERVATION_MEDIA_BUCKET, type MediaBucket } from '@/lib/utils/storage'
import { type TableName } from './constants'
import { buildReadableMediaPath } from './view-export-paths'

export interface SummaryRow {
  metric: string
  value: number
}

export interface WalkViewRow {
  roundName: string
  walkDate: string
  location: string
  startTime: string
  endTime: string
  maxVolunteers: number | ''
  joinedVolunteers: number
  cancelledVolunteers: number
  observationCount: number
  sightingCount: number
  incidentCount: number
  mediaCount: number
}

export interface ObservationViewRow {
  roundName: string
  walkDate: string
  location: string
  observerName: string
  observerEmail: string
  observationStatus: string
  outcome: string
  walkCompletion: string
  observationLat: number | ''
  observationLng: number | ''
  notes: string
  submittedAt: string
  sightingCount: number
  mediaCount: number
  mediaFiles: string
}

export interface SightingViewRow {
  roundName: string
  walkDate: string
  location: string
  observerName: string
  observerEmail: string
  species: string
  count: number | ''
  sightingLat: number | ''
  sightingLng: number | ''
  observedAt: string
  sightingNotes: string
  observationOutcome: string
  mediaCount: number
  mediaFiles: string
}

export interface IncidentViewRow {
  roundName: string
  walkDate: string
  location: string
  reportedByName: string
  reportedByEmail: string
  incidentType: string
  description: string
  lat: number | ''
  lng: number | ''
  resolved: boolean | ''
  resolvedNotes: string
  createdAt: string
  mediaCount: number
  mediaFiles: string
}

export interface MediaViewRow {
  roundName: string
  walkDate: string
  location: string
  observerName: string
  observerEmail: string
  observationId: string
  sightingId: string
  incidentId: string
  species: string
  count: number | ''
  fileName: string
  mediaType: string
  fileSize: number | ''
  originalStoragePath: string
  viewExportPath: string
  storageBucket: MediaBucket
  exifLat: number | ''
  exifLng: number | ''
  exifDatetime: string
  createdAt: string
}

export interface ViewExportMediaManifestItem {
  storageBucket: MediaBucket
  storagePath: string
  zipPath: string
}

export interface ViewExportData {
  summaryRows: SummaryRow[]
  walkRows: WalkViewRow[]
  observationRows: ObservationViewRow[]
  sightingRows: SightingViewRow[]
  incidentRows: IncidentViewRow[]
  mediaRows: MediaViewRow[]
  mediaManifest: ViewExportMediaManifestItem[]
}

type RawTableData = Record<TableName, Record<string, unknown>[]>

type ProfileRow = Record<string, unknown>
type RoundRow = Record<string, unknown>
type WalkRow = Record<string, unknown>
type ObservationRow = Record<string, unknown>
type SightingRow = Record<string, unknown>
type MediaRow = Record<string, unknown>
type IncidentRow = Record<string, unknown>
type MembershipRow = Record<string, unknown>

function asString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function asNumber(value: unknown): number | '' {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return ''
}

function groupBy<T extends Record<string, unknown>>(rows: T[], key: string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const value = asString(row[key])
    if (!value) continue
    const group = map.get(value)
    if (group) {
      group.push(row)
    } else {
      map.set(value, [row])
    }
  }
  return map
}

function indexBy<T extends Record<string, unknown>>(rows: T[], key: string): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) {
    const value = asString(row[key])
    if (value) map.set(value, row)
  }
  return map
}

function getProfileDisplay(profile: ProfileRow | undefined) {
  return {
    name: asString(profile?.full_name) || asString(profile?.email) || asString(profile?.id) || 'Unknown User',
    email: asString(profile?.email),
  }
}

function getWalkContext(
  walk: WalkRow | undefined,
  roundsById: Map<string, RoundRow>
) {
  const round = roundsById.get(asString(walk?.round_id))
  return {
    roundId: asString(round?.id),
    walkId: asString(walk?.id),
    roundName: asString(round?.name) || 'Unknown Round',
    walkDate: asString(walk?.walk_date),
    location: asString(walk?.location_name) || 'Unknown Walk',
    startTime: asString(walk?.start_time),
    endTime: asString(walk?.end_time),
    maxVolunteers: asNumber(walk?.max_volunteers),
  }
}

export function buildViewExportData(tableData: RawTableData): ViewExportData {
  const profilesById = indexBy(tableData.profiles as ProfileRow[], 'id')
  const roundsById = indexBy(tableData.survey_rounds as RoundRow[], 'id')
  const walksById = indexBy(tableData.walk_slots as WalkRow[], 'id')
  const observationsById = indexBy(tableData.observations as ObservationRow[], 'id')
  const sightingsById = indexBy(tableData.sightings as SightingRow[], 'id')
  const incidentsById = indexBy(tableData.incidents as IncidentRow[], 'id')

  const membershipsBySlotId = groupBy(tableData.slot_memberships as MembershipRow[], 'slot_id')
  const observationsBySlotId = groupBy(tableData.observations as ObservationRow[], 'slot_id')
  const sightingsByObservationId = groupBy(tableData.sightings as SightingRow[], 'observation_id')
  const incidentsBySlotId = groupBy(tableData.incidents as IncidentRow[], 'slot_id')

  const mediaBySightingId = groupBy(
    (tableData.media as MediaRow[]).filter(row => asString(row.sighting_id)),
    'sighting_id'
  )
  const usedMediaPaths = new Set<string>()
  const mediaRows: MediaViewRow[] = []
  const mediaManifest: ViewExportMediaManifestItem[] = []

  for (const media of tableData.media as MediaRow[]) {
    const incident = incidentsById.get(asString(media.incident_id))
    const sighting = sightingsById.get(asString(media.sighting_id))
    const observation = observationsById.get(asString(media.observation_id))
      ?? observationsById.get(asString(sighting?.observation_id))
    const walk = incident
      ? walksById.get(asString(incident.slot_id))
      : walksById.get(asString(observation?.slot_id))
    const userProfile = incident
      ? profilesById.get(asString(incident.reported_by))
      : profilesById.get(asString(observation?.user_id))
    const user = getProfileDisplay(userProfile)
    const walkContext = getWalkContext(walk, roundsById)
    const storageBucket: MediaBucket = asString(media.incident_id)
      ? INCIDENT_MEDIA_BUCKET
      : OBSERVATION_MEDIA_BUCKET

    const zipPath = buildReadableMediaPath(
      {
        roundId: walkContext.roundId,
        roundName: walkContext.roundName,
        walkId: walkContext.walkId,
        walkDate: walkContext.walkDate,
        locationName: walkContext.location,
        userName: user.name,
        userFallback: user.email,
        userId: incident ? asString(incident.reported_by) : asString(observation?.user_id),
        incidentId: asString(media.incident_id),
        species: asString(sighting?.species),
        count: asNumber(sighting?.count) === '' ? null : Number(asNumber(sighting?.count)),
        sightingId: asString(media.sighting_id),
        fileName: asString(media.file_name) || asString(media.file_path),
      },
      usedMediaPaths
    )

    mediaRows.push({
      roundName: walkContext.roundName,
      walkDate: walkContext.walkDate,
      location: walkContext.location,
      observerName: user.name,
      observerEmail: user.email,
      observationId: asString(observation?.id),
      sightingId: asString(media.sighting_id),
      incidentId: asString(media.incident_id),
      species: asString(sighting?.species),
      count: asNumber(sighting?.count),
      fileName: asString(media.file_name),
      mediaType: asString(media.media_type),
      fileSize: asNumber(media.file_size),
      originalStoragePath: asString(media.file_path),
      viewExportPath: zipPath,
      storageBucket,
      exifLat: asNumber(media.exif_lat),
      exifLng: asNumber(media.exif_lng),
      exifDatetime: asString(media.exif_datetime),
      createdAt: asString(media.created_at),
    })

    if (asString(media.file_path)) {
      mediaManifest.push({
        storageBucket,
        storagePath: asString(media.file_path),
        zipPath,
      })
    }
  }

  const walkRows: WalkViewRow[] = (tableData.walk_slots as WalkRow[]).map(walk => {
    const walkId = asString(walk.id)
    const walkContext = getWalkContext(walk, roundsById)
    const memberships = membershipsBySlotId.get(walkId) ?? []
    const observations = observationsBySlotId.get(walkId) ?? []
    const incidents = incidentsBySlotId.get(walkId) ?? []
    const sightingCount = observations.reduce(
      (total, observation) => total + (sightingsByObservationId.get(asString(observation.id))?.length ?? 0),
      0
    )
    const mediaCount = mediaRows.filter(row =>
      observations.some(observation => asString(observation.id) === row.observationId)
      || incidents.some(incident => asString(incident.id) === row.incidentId)
    ).length

    return {
      ...walkContext,
      joinedVolunteers: memberships.filter(row => asString(row.status) === 'JOINED').length,
      cancelledVolunteers: memberships.filter(row => asString(row.status) === 'CANCELLED').length,
      observationCount: observations.length,
      sightingCount,
      incidentCount: incidents.length,
      mediaCount,
    }
  })

  const observationRows: ObservationViewRow[] = (tableData.observations as ObservationRow[]).map(observation => {
    const walk = walksById.get(asString(observation.slot_id))
    const walkContext = getWalkContext(walk, roundsById)
    const user = getProfileDisplay(profilesById.get(asString(observation.user_id)))
    const sightings = sightingsByObservationId.get(asString(observation.id)) ?? []
    const media = mediaRows.filter(row => row.observationId === asString(observation.id))

    return {
      ...walkContext,
      observerName: user.name,
      observerEmail: user.email,
      observationStatus: asString(observation.status),
      outcome: asString(observation.outcome),
      walkCompletion: asString(observation.walk_completion),
      observationLat: asNumber(observation.lat),
      observationLng: asNumber(observation.lng),
      notes: asString(observation.notes),
      submittedAt: asString(observation.submitted_at),
      sightingCount: sightings.length,
      mediaCount: media.length,
      mediaFiles: media.map(row => row.viewExportPath).join('; '),
    }
  })

  const sightingRows: SightingViewRow[] = (tableData.sightings as SightingRow[]).map(sighting => {
    const observation = observationsById.get(asString(sighting.observation_id))
    const walk = walksById.get(asString(observation?.slot_id))
    const walkContext = getWalkContext(walk, roundsById)
    const user = getProfileDisplay(profilesById.get(asString(observation?.user_id)))
    const media = mediaBySightingId.get(asString(sighting.id)) ?? []
    const mediaPaths = mediaRows
      .filter(row => row.sightingId === asString(sighting.id))
      .map(row => row.viewExportPath)

    return {
      ...walkContext,
      observerName: user.name,
      observerEmail: user.email,
      species: asString(sighting.species),
      count: asNumber(sighting.count),
      sightingLat: asNumber(sighting.lat),
      sightingLng: asNumber(sighting.lng),
      observedAt: asString(sighting.observed_at),
      sightingNotes: asString(sighting.notes),
      observationOutcome: asString(observation?.outcome),
      mediaCount: media.length,
      mediaFiles: mediaPaths.join('; '),
    }
  })

  const incidentRows: IncidentViewRow[] = (tableData.incidents as IncidentRow[]).map(incident => {
    const walk = walksById.get(asString(incident.slot_id))
    const walkContext = getWalkContext(walk, roundsById)
    const reporter = getProfileDisplay(profilesById.get(asString(incident.reported_by)))
    const mediaPaths = mediaRows
      .filter(row => row.incidentId === asString(incident.id))
      .map(row => row.viewExportPath)

    return {
      ...walkContext,
      reportedByName: reporter.name,
      reportedByEmail: reporter.email,
      incidentType: asString(incident.incident_type),
      description: asString(incident.description),
      lat: asNumber(incident.lat),
      lng: asNumber(incident.lng),
      resolved: typeof incident.resolved === 'boolean' ? incident.resolved : '',
      resolvedNotes: asString(incident.resolved_notes),
      createdAt: asString(incident.created_at),
      mediaCount: mediaPaths.length,
      mediaFiles: mediaPaths.join('; '),
    }
  })

  const summaryRows: SummaryRow[] = [
    { metric: 'Survey Rounds', value: tableData.survey_rounds.length },
    { metric: 'Walks', value: tableData.walk_slots.length },
    { metric: 'Volunteers', value: tableData.profiles.length },
    { metric: 'Observations', value: tableData.observations.length },
    { metric: 'Sightings', value: tableData.sightings.length },
    { metric: 'Incidents', value: tableData.incidents.length },
    { metric: 'Media Files', value: tableData.media.length },
  ]

  return {
    summaryRows,
    walkRows,
    observationRows,
    sightingRows,
    incidentRows,
    mediaRows,
    mediaManifest,
  }
}
