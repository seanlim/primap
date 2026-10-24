// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TABLE_ORDER, type TableName } from '@/lib/export-import/constants'

const { adminFrom, fetchRows, download, upload } = vi.hoisted(() => ({
  adminFrom: vi.fn(), fetchRows: vi.fn(), download: vi.fn(), upload: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'test-admin' } } })) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: { role: 'ADMIN' } })),
    })),
  })),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({ from: adminFrom })) }))
vi.mock('@/lib/export-import/media-helpers', () => ({
  fetchAllRows: fetchRows, downloadMediaFile: download, uploadMediaFile: upload,
}))

import { GET as exportBackup } from '@/app/api/admin/export/route'
import { GET as exportView } from '@/app/api/admin/export-view/route'
import { POST as restoreBackup } from '@/app/api/admin/import/route'

const user = '11111111-1111-4111-8111-111111111111'
const round = '22222222-2222-4222-8222-222222222222'
const walks = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
const observations = ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666']
const sighting = '77777777-7777-4777-8777-777777777777'
const timestamp = '2026-10-24T12:00:00Z'
const comments = ['Partial: trail flooded\nReturned early', 'Aborted: heavy rain']
let db: PGlite
let tableData: Record<TableName, Record<string, unknown>[]>

function request(buffer: ArrayBuffer) {
  return {
    formData: async () => ({ get: () => ({ arrayBuffer: async () => buffer }) }),
  } as unknown as Parameters<typeof restoreBackup>[0]
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`)
  for (const file of [
    '20260221103142_create_enums.sql', '20260221103200_create_core_tables.sql',
    '20260326025335_add_last_user_agent_to_observations.sql',
    '20260402080428_add_other_species_type.sql',
    '20260409042744_add_incident_media_support.sql',
    '20260413091457_add_completion_comment_to_observations.sql',
    '20260719122751_change_observation_schema.sql',
  ]) await db.exec(readFileSync(resolve('supabase/migrations', file), 'utf8'))
  await db.exec(`INSERT INTO auth.users VALUES ('${user}');
    INSERT INTO public.profiles (id, email) VALUES ('${user}', 'volunteer@example.test');
    INSERT INTO public.survey_rounds (id, name, start_date, end_date)
      VALUES ('${round}', 'Synthetic round', '2026-10-01', '2026-10-31');
    INSERT INTO public.walk_slots (id, round_id, location_name, walk_date, start_time, end_time)
      VALUES ('${walks[0]}', '${round}', 'Synthetic walk A', '2026-10-26', '07:00', '09:00'),
             ('${walks[1]}', '${round}', 'Synthetic walk B', '2026-10-27', '07:00', '09:00');`)
}, 30_000)

afterAll(async () => { await db?.close() })

beforeEach(async () => {
  vi.clearAllMocks()
  await db.exec('TRUNCATE public.observations CASCADE')
  tableData = {} as typeof tableData
  for (const table of TABLE_ORDER) tableData[table] = []
  tableData.observations = observations.map((id, index) => ({
    id, slot_id: walks[index], status: 'SUBMITTED', outcome: 'SIGHTED',
    walk_completion: index === 0 ? 'PARTIAL' : 'ABORTED', completion_comment: comments[index],
    lat: null, lng: null, notes: 'Synthetic report', submitted_at: timestamp,
    client_draft_id: null, last_user_agent: 'test', created_at: timestamp, updated_at: timestamp,
  }))
  tableData.sightings = [{
    id: sighting, observation_id: observations[0], species: 'OTHER', species_other: 'Silvered langur',
    count: '2', lat: 1.35, lng: 103.82, observed_at: timestamp, notes: 'Synthetic sighting', created_at: timestamp,
  }]
  tableData.media = [
    { id: '88888888-8888-4888-8888-888888888888', observation_id: observations[0], sighting_id: null },
    { id: '99999999-9999-4999-8999-999999999999', observation_id: null, sighting_id: sighting },
  ].map((row, index) => ({
    ...row, incident_id: null, file_path: `${user}/${row.observation_id ?? row.sighting_id}/photo${index}.jpg`,
    file_name: `photo${index}.jpg`, media_type: 'PHOTO', file_size: 3,
    exif_lat: null, exif_lng: null, exif_datetime: null, created_at: timestamp,
  }))
  fetchRows.mockImplementation(async (_client: unknown, table: TableName) => tableData[table])
  download.mockResolvedValue({ data: new Uint8Array([1, 2, 3]).buffer, error: null })
  upload.mockResolvedValue({ error: null, skipped: false })

  // Only the Supabase transport is replaced: restore payloads execute against
  // the real migrated PostgreSQL tables, including their constraints.
  adminFrom.mockImplementation((table: TableName) => ({
    upsert: (rows: Record<string, unknown>[]) => ({
      select: async () => {
        const inserted: { id: string }[] = []
        try {
          for (const row of rows) {
            const columns = Object.keys(row)
            const quoted = columns.map(column => '"' + column.replaceAll('"', '""') + '"')
            const placeholders = columns.map((_, i) => `$${i + 1}`)
            const result = await db.query<{ id: string }>(
              `INSERT INTO public."${table}" (${quoted.join(',')}) VALUES (${placeholders.join(',')})
               ON CONFLICT (id) DO NOTHING RETURNING id`, columns.map(column => row[column])
            )
            inserted.push(...result.rows)
          }
          return { data: inserted, error: null }
        } catch (error) {
          return { data: null, error: { message: String(error) } }
        }
      },
    }),
  }))
})

it('exports a real backup ZIP and restores both report fields and media records', async () => {
  const exported = await exportBackup()
  expect(exported.status).toBe(200)
  const buffer = await exported.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)
  expect(zip.file('primap-data.xlsx')).not.toBeNull()
  for (const row of tableData.media) {
    expect(await zip.file(`media/${row.file_path}`)!.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]))
  }
  const restored = await restoreBackup(request(buffer))
  expect(restored.status).toBe(200)
  const { summary } = await restored.json()
  for (const table of ['observations', 'sightings', 'media']) expect(summary[table].errors).toEqual([])
  expect(summary.observations.inserted).toBe(2)
  expect(summary.sightings.inserted).toBe(1)
  expect(summary.media.inserted).toBe(2)
  expect(upload).toHaveBeenCalledTimes(2)
  const reports = await db.query<{ completion_comment: string | null }>('SELECT completion_comment FROM public.observations ORDER BY id')
  expect(reports.rows.map(row => row.completion_comment)).toEqual(comments)
  expect((await db.query('SELECT species_other FROM public.sightings')).rows).toEqual([{ species_other: 'Silvered langur' }])
  expect((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM public.media')).rows[0].count).toBe(2)
})

it('exports the saved fields and all media in an actual viewing ZIP', async () => {
  const exported = await exportView()
  expect(exported.status).toBe(200)
  const zip = await JSZip.loadAsync(await exported.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await zip.file('primap-view.xlsx')!.async('arraybuffer'))
  const reports = workbook.getWorksheet('Observations')!
  const sightings = workbook.getWorksheet('Sightings')!
  const commentColumn = (reports.getRow(1).values as unknown[]).indexOf('Completion Comment')
  const speciesColumn = (sightings.getRow(1).values as unknown[]).indexOf('Other Species Name')
  expect(commentColumn).toBeGreaterThan(0)
  expect(speciesColumn).toBeGreaterThan(0)
  expect(reports.getRow(2).getCell(commentColumn).value).toBe(comments[0])
  expect(reports.getRow(3).getCell(commentColumn).value).toBe(comments[1])
  expect(sightings.getRow(2).getCell(speciesColumn).value).toBe('Silvered langur')
  const media = Object.values(zip.files).filter(file => !file.dir && file.name.startsWith('media/'))
  expect(media).toHaveLength(2)
  for (const file of media) expect(await file.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]))
})

it('restores an older backup with observation user_id and without the new columns', async () => {
  const workbook = new ExcelJS.Workbook()
  const reports = workbook.addWorksheet('observations')
  reports.addRow(['id', 'slot_id', 'user_id', 'status', 'outcome', 'walk_completion'])
  reports.addRow([observations[0], walks[0], user, 'DRAFT', 'NOT_SIGHTED', 'PARTIAL'])
  const sightings = workbook.addWorksheet('sightings')
  sightings.addRow(['id', 'observation_id', 'species', 'count', 'lat', 'lng'])
  sightings.addRow([sighting, observations[0], 'RBL', '1', 1.35, 103.82])
  const zip = new JSZip()
  zip.file('primap-data.xlsx', await workbook.xlsx.writeBuffer())
  const restored = await restoreBackup(request(await zip.generateAsync({ type: 'arraybuffer' })))
  const { summary } = await restored.json()
  expect(restored.status).toBe(200)
  expect(summary.observations.errors).toEqual([])
  expect(summary.observations.inserted).toBe(1)
  expect(summary.sightings.errors).toEqual([])
  expect(summary.sightings.inserted).toBe(1)
  expect((await db.query('SELECT completion_comment FROM public.observations')).rows).toEqual([{ completion_comment: null }])
  expect((await db.query('SELECT species_other FROM public.sightings')).rows).toEqual([{ species_other: null }])
})
