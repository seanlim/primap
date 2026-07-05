import { describe, it, expect } from 'vitest'
import {
  TABLE_ORDER,
  TABLE_COLUMNS,
  TABLE_WORKSHEET_NAMES,
  STORAGE_BUCKET,
  EXPORT_XLSX_FILENAME,
  MEDIA_DIR,
  LEGACY_REQUIRED_COLUMNS,
  LEGACY_OPTIONAL_COLUMNS,
  VALID_SPECIES,
  VALID_OUTCOMES,
  VALID_WALK_COMPLETIONS,
  VALID_INCIDENT_TYPES,
  BATCH_SIZE,
  PAGE_SIZE,
  type TableName,
} from '@/lib/export-import/constants'

describe('constants', () => {
  describe('TABLE_ORDER', () => {
    it('contains all 10 exported tables', () => {
      expect(TABLE_ORDER).toHaveLength(10)
    })

    it('lists tables in FK-dependency order (parents before children)', () => {
      const indexOf = (t: string) => TABLE_ORDER.indexOf(t as TableName)

      // profiles must come before tables that reference it
      expect(indexOf('profiles')).toBeLessThan(indexOf('survey_rounds'))
      expect(indexOf('profiles')).toBeLessThan(indexOf('slot_memberships'))
      expect(indexOf('profiles')).toBeLessThan(indexOf('observations'))
      expect(indexOf('profiles')).toBeLessThan(indexOf('incidents'))

      // survey_rounds before walk_slots
      expect(indexOf('survey_rounds')).toBeLessThan(indexOf('walk_slots'))
      expect(indexOf('survey_rounds')).toBeLessThan(indexOf('round_participation_requirements'))

      // walk_slots before slot_memberships, observations, incidents
      expect(indexOf('walk_slots')).toBeLessThan(indexOf('slot_memberships'))
      expect(indexOf('walk_slots')).toBeLessThan(indexOf('observations'))
      expect(indexOf('walk_slots')).toBeLessThan(indexOf('incidents'))

      // observations before sightings and media
      expect(indexOf('observations')).toBeLessThan(indexOf('sightings'))
      expect(indexOf('observations')).toBeLessThan(indexOf('media'))

      // sightings before media (media can reference sighting_id)
      expect(indexOf('sightings')).toBeLessThan(indexOf('media'))
    })

    it('includes all expected table names', () => {
      const expected = [
        'profiles', 'survey_rounds', 'round_participation_requirements', 'walk_slots', 'slot_memberships',
        'observations', 'sightings', 'media', 'incidents', 'app_settings',
      ]
      expect([...TABLE_ORDER]).toEqual(expect.arrayContaining(expected))
      expect(expected).toEqual(expect.arrayContaining([...TABLE_ORDER]))
    })

    it('defines unique Excel-safe worksheet names for exported tables', () => {
      const worksheetNames = TABLE_ORDER.map(table => TABLE_WORKSHEET_NAMES[table])
      expect(new Set(worksheetNames).size).toBe(TABLE_ORDER.length)
      for (const worksheetName of worksheetNames) {
        expect(worksheetName.length).toBeLessThanOrEqual(31)
      }
    })
  })

  describe('TABLE_COLUMNS', () => {
    it('has column definitions for every table in TABLE_ORDER', () => {
      for (const table of TABLE_ORDER) {
        expect(TABLE_COLUMNS[table]).toBeDefined()
        expect(TABLE_COLUMNS[table].length).toBeGreaterThan(0)
      }
    })

    it('every table has an id column as first column', () => {
      for (const table of TABLE_ORDER) {
        expect(TABLE_COLUMNS[table][0]).toBe('id')
      }
    })

    it('every table has a timestamp column (created_at or joined_at)', () => {
      for (const table of TABLE_ORDER) {
        const cols = TABLE_COLUMNS[table]
        const hasTimestamp = cols.includes('created_at') || cols.includes('joined_at')
        expect(hasTimestamp).toBe(true)
      }
    })

    it('profiles columns match DB schema', () => {
      expect(TABLE_COLUMNS.profiles).toEqual([
        'id', 'email', 'full_name', 'avatar_url', 'phone_number', 'phone_verified_at',
        'birth_month',
        'role', 'status', 'created_at', 'updated_at',
      ])
    })

    it('round requirement columns include indemnity and guardian verification fields', () => {
      expect(TABLE_COLUMNS.round_participation_requirements).toEqual([
        'id', 'user_id', 'round_id', 'indemnity_acknowledged_at',
        'guardian_name', 'guardian_email', 'guardian_email_verified_at',
        'guardian_phone_number', 'guardian_phone_verified_at',
        'created_at', 'updated_at',
      ])
    })

    it('observations columns include all expected fields', () => {
      const cols = TABLE_COLUMNS.observations
      expect(cols).toContain('slot_id')
      expect(cols).toContain('user_id')
      expect(cols).toContain('outcome')
      expect(cols).toContain('walk_completion')
      expect(cols).toContain('lat')
      expect(cols).toContain('lng')
      expect(cols).toContain('submitted_at')
      expect(cols).toContain('client_draft_id')
    })

    it('media columns include file and EXIF fields', () => {
      const cols = TABLE_COLUMNS.media
      expect(cols).toContain('incident_id')
      expect(cols).toContain('file_path')
      expect(cols).toContain('file_name')
      expect(cols).toContain('file_size')
      expect(cols).toContain('media_type')
      expect(cols).toContain('exif_lat')
      expect(cols).toContain('exif_lng')
      expect(cols).toContain('exif_datetime')
    })

    it('sightings columns include species and count', () => {
      const cols = TABLE_COLUMNS.sightings
      expect(cols).toContain('observation_id')
      expect(cols).toContain('species')
      expect(cols).toContain('count')
      expect(cols).toContain('lat')
      expect(cols).toContain('lng')
    })
  })

  describe('enum constants', () => {
    it('VALID_SPECIES matches DB enum', () => {
      expect(VALID_SPECIES).toEqual(['RBL', 'LTM', 'DUSKY'])
    })

    it('VALID_OUTCOMES matches DB enum', () => {
      expect(VALID_OUTCOMES).toEqual(['SIGHTED', 'NOT_SIGHTED'])
    })

    it('VALID_WALK_COMPLETIONS matches DB enum', () => {
      expect(VALID_WALK_COMPLETIONS).toEqual(['COMPLETED', 'PARTIAL', 'ABORTED'])
    })

    it('VALID_INCIDENT_TYPES matches DB enum', () => {
      expect(VALID_INCIDENT_TYPES).toEqual([
        'INJURED_ANIMAL', 'DEAD_ANIMAL', 'HUMAN_WILDLIFE_CONFLICT', 'HABITAT_DAMAGE', 'OTHER',
      ])
    })
  })

  describe('legacy import columns', () => {
    it('required columns include all mandatory fields', () => {
      expect(LEGACY_REQUIRED_COLUMNS).toContain('round_name')
      expect(LEGACY_REQUIRED_COLUMNS).toContain('observer_email')
      expect(LEGACY_REQUIRED_COLUMNS).toContain('outcome')
      expect(LEGACY_REQUIRED_COLUMNS).toContain('walk_completion')
      expect(LEGACY_REQUIRED_COLUMNS).toContain('walk_date')
    })

    it('optional columns include species and coordinate fields', () => {
      expect(LEGACY_OPTIONAL_COLUMNS).toContain('species')
      expect(LEGACY_OPTIONAL_COLUMNS).toContain('count')
      expect(LEGACY_OPTIONAL_COLUMNS).toContain('observation_lat')
      expect(LEGACY_OPTIONAL_COLUMNS).toContain('sighting_lat')
    })

    it('no overlap between required and optional columns', () => {
      const required = new Set<string>([...LEGACY_REQUIRED_COLUMNS])
      for (const col of LEGACY_OPTIONAL_COLUMNS) {
        expect(required.has(col)).toBe(false)
      }
    })
  })

  describe('config values', () => {
    it('STORAGE_BUCKET is observation-media', () => {
      expect(STORAGE_BUCKET).toBe('observation-media')
    })

    it('EXPORT_XLSX_FILENAME is primap-data.xlsx', () => {
      expect(EXPORT_XLSX_FILENAME).toBe('primap-data.xlsx')
    })

    it('MEDIA_DIR is media', () => {
      expect(MEDIA_DIR).toBe('media')
    })

    it('BATCH_SIZE is a positive integer', () => {
      expect(BATCH_SIZE).toBeGreaterThan(0)
      expect(Number.isInteger(BATCH_SIZE)).toBe(true)
    })

    it('PAGE_SIZE is a positive integer', () => {
      expect(PAGE_SIZE).toBeGreaterThan(0)
      expect(Number.isInteger(PAGE_SIZE)).toBe(true)
    })
  })
})
