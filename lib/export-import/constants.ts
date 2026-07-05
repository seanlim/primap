export const TABLE_ORDER = [
  'profiles',
  'survey_rounds',
  'round_participation_requirements',
  'walk_slots',
  'slot_memberships',
  'observations',
  'sightings',
  'media',
  'incidents',
  'app_settings',
] as const

export type TableName = (typeof TABLE_ORDER)[number]

export const TABLE_WORKSHEET_NAMES: Record<TableName, string> = {
  profiles: 'profiles',
  survey_rounds: 'survey_rounds',
  round_participation_requirements: 'round_participation_reqs',
  walk_slots: 'walk_slots',
  slot_memberships: 'slot_memberships',
  observations: 'observations',
  sightings: 'sightings',
  media: 'media',
  incidents: 'incidents',
  app_settings: 'app_settings',
}

export const WORKSHEET_TABLE_NAMES = Object.fromEntries(
  Object.entries(TABLE_WORKSHEET_NAMES).map(([table, worksheet]) => [worksheet, table])
) as Record<string, TableName>

export const TABLE_COLUMNS: Record<TableName, string[]> = {
  profiles: [
    'id', 'email', 'full_name', 'avatar_url', 'phone_number', 'phone_verified_at',
    'birth_month',
    'role', 'status', 'created_at', 'updated_at',
  ],
  survey_rounds: ['id', 'name', 'description', 'start_date', 'end_date', 'indemnity_form_url', 'status', 'created_by', 'created_at', 'updated_at'],
  round_participation_requirements: [
    'id', 'user_id', 'round_id', 'indemnity_acknowledged_at',
    'guardian_name', 'guardian_email', 'guardian_email_verified_at',
    'guardian_phone_number', 'guardian_phone_verified_at',
    'created_at', 'updated_at',
  ],
  walk_slots: ['id', 'round_id', 'location_name', 'walk_date', 'start_time', 'end_time', 'max_volunteers', 'created_at', 'updated_at'],
  slot_memberships: ['id', 'slot_id', 'user_id', 'status', 'joined_at', 'cancelled_at'],
  observations: ['id', 'slot_id', 'user_id', 'status', 'outcome', 'walk_completion', 'lat', 'lng', 'notes', 'submitted_at', 'client_draft_id', 'last_user_agent', 'created_at', 'updated_at'],
  sightings: ['id', 'observation_id', 'species', 'count', 'lat', 'lng', 'observed_at', 'notes', 'created_at'],
  media: ['id', 'observation_id', 'sighting_id', 'incident_id', 'file_path', 'file_name', 'file_size', 'media_type', 'exif_lat', 'exif_lng', 'exif_datetime', 'created_at'],
  incidents: ['id', 'slot_id', 'reported_by', 'incident_type', 'description', 'lat', 'lng', 'resolved', 'resolved_notes', 'created_at', 'updated_at'],
  app_settings: ['id', 'required_walks_per_round', 'late_cancel_hours', 'high_participation_threshold', 'max_media_per_report', 'created_at', 'updated_at'],
}

// Re-exported from lib/utils/storage to keep the default export/import bucket
// reference in sync. View/backup exports can handle incident media explicitly.
export { OBSERVATION_MEDIA_BUCKET as STORAGE_BUCKET } from '@/lib/utils/storage'
export const EXPORT_XLSX_FILENAME = 'primap-data.xlsx'
export const MEDIA_DIR = 'media'

export const LEGACY_REQUIRED_COLUMNS = [
  'round_name',
  'location_name',
  'walk_date',
  'start_time',
  'end_time',
  'observer_email',
  'walk_completion',
  'outcome',
] as const

export const LEGACY_OPTIONAL_COLUMNS = [
  'observation_notes',
  'observation_lat',
  'observation_lng',
  'species',
  'count',
  'sighting_lat',
  'sighting_lng',
  'observed_at',
  'sighting_notes',
] as const

export const VALID_SPECIES = ['RBL', 'LTM', 'DUSKY'] as const
export const VALID_OUTCOMES = ['SIGHTED', 'NOT_SIGHTED'] as const
export const VALID_WALK_COMPLETIONS = ['COMPLETED', 'PARTIAL', 'ABORTED'] as const
export const VALID_INCIDENT_TYPES = ['INJURED_ANIMAL', 'DEAD_ANIMAL', 'HUMAN_WILDLIFE_CONFLICT', 'HABITAT_DAMAGE', 'OTHER'] as const

export const BATCH_SIZE = 100
export const PAGE_SIZE = 1000
