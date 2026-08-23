import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildViewExportWorkbook } from '@/lib/export-import/build-view-export-workbook'
import type { ViewExportData } from '@/lib/export-import/build-view-export-data'

async function parseWorkbook(buffer: ExcelJS.Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ArrayBuffer)
  return workbook
}

function makeViewExportData(): ViewExportData {
  return {
    summaryRows: [{ metric: 'Walks', value: 3 }],
    walkRows: [{
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      location: 'Pasir Ris Park',
      startTime: '07:00',
      endTime: '09:00',
      maxVolunteers: 8,
      joinedVolunteers: 5,
      cancelledVolunteers: 1,
      observationCount: 4,
      sightingCount: 2,
      incidentCount: 1,
      mediaCount: 6,
    }],
    observationRows: [{
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      location: 'Pasir Ris Park',
      observerName: 'Tan Wei Ming',
      observerEmail: 'volunteer@example.com',
      observationStatus: 'SUBMITTED',
      outcome: 'SIGHTED',
      walkCompletion: 'COMPLETED',
      observationLat: 1.234,
      observationLng: 103.456,
      notes: 'Saw movement',
      submittedAt: '2026-03-14T09:15:00Z',
      sightingCount: 1,
      mediaCount: 2,
      mediaFiles: 'media/Round 1/.../photo.jpg',
    }],
    sightingRows: [{
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      location: 'Pasir Ris Park',
      observerName: 'Tan Wei Ming',
      observerEmail: 'volunteer@example.com',
      species: 'RBL',
      count: 2,
      sightingLat: 1.234,
      sightingLng: 103.456,
      observedAt: '2026-03-14T08:10:00Z',
      sightingNotes: 'Near the boardwalk',
      observationOutcome: 'SIGHTED',
      mediaCount: 1,
      mediaFiles: 'media/Round 1/.../sighting.jpg',
    }],
    incidentRows: [{
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      location: 'Pasir Ris Park',
      reportedByName: 'Tan Wei Ming',
      reportedByEmail: 'volunteer@example.com',
      incidentType: 'OTHER',
      description: 'Trail blocked',
      lat: '',
      lng: '',
      resolved: false,
      resolvedNotes: '',
      createdAt: '2026-03-14T09:30:00Z',
      mediaCount: 1,
      mediaFiles: 'media/Round 1/.../incident.jpg',
    }],
    mediaRows: [{
      roundName: 'Round 1',
      walkDate: '2026-03-14',
      location: 'Pasir Ris Park',
      observerName: 'Tan Wei Ming',
      observerEmail: 'volunteer@example.com',
      observationId: 'o1',
      sightingId: 's1',
      species: 'RBL',
      count: 2,
      fileName: 'sighting.jpg',
      mediaType: 'image/jpeg',
      incidentId: '',
      storageBucket: 'incident-media',
      fileSize: 2048,
      originalStoragePath: 'u1/o1/s1/sighting.jpg',
      viewExportPath: 'media/Round 1/.../sighting.jpg',
      exifLat: '',
      exifLng: '',
      exifDatetime: '',
      createdAt: '2026-03-14T08:10:00Z',
    }],
    mediaManifest: [],
  }
}

describe('buildViewExportWorkbook', () => {
  it('creates the expected sheets in order', async () => {
    const workbook = await parseWorkbook(await buildViewExportWorkbook(makeViewExportData()))
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
      'Summary',
      'Walks',
      'Observations',
      'Sightings',
      'Incidents',
    ])
  })

  it('writes friendly headers and rows', async () => {
    const workbook = await parseWorkbook(await buildViewExportWorkbook(makeViewExportData()))
    const observations = workbook.getWorksheet('Observations')!
    const incidents = workbook.getWorksheet('Incidents')!

    expect(observations.getRow(1).getCell(1).value).toBe('Round Name')
    expect(observations.getRow(2).getCell(4).value).toBe('Tan Wei Ming')
    expect(observations.getRow(2).getCell(15).value).toBe('media/Round 1/.../photo.jpg')
    expect(incidents.getRow(1).getCell(13).value).toBe('Media Count')
    expect(incidents.getRow(1).getCell(14).value).toBe('Media Files')
    expect(incidents.getRow(2).getCell(13).value).toBe(1)
    expect(incidents.getRow(2).getCell(14).value).toBe('media/Round 1/.../incident.jpg')
  })

  it('keeps round names as plain text even when they look like dates', async () => {
    const data = makeViewExportData()
    data.walkRows[0].roundName = '2026-03-14'

    const workbook = await parseWorkbook(await buildViewExportWorkbook(data))
    const walks = workbook.getWorksheet('Walks')!

    expect(walks.getRow(2).getCell(1).value).toBe('2026-03-14')
    expect(walks.getRow(2).getCell(2).value).toBeInstanceOf(Date)
  })
})
