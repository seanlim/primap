import ExcelJS from 'exceljs'
import { type ViewExportData } from './build-view-export-data'

type WorksheetColumn<T extends object> = {
  header: string
  key: keyof T
  width?: number
  kind?: 'date' | 'datetime' | 'multiline' | 'path'
}

function parseCellValue(value: unknown, kind?: WorksheetColumn<object>['kind']): unknown {
  if (kind !== 'date' && kind !== 'datetime') return value
  if (typeof value !== 'string') return value
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed
}

function addWorksheet<T extends object>(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: WorksheetColumn<T>[],
  rows: T[]
) {
  const worksheet = workbook.addWorksheet(name)
  worksheet.columns = columns.map(column => ({
    header: column.header,
    key: String(column.key),
    width: column.width ?? 18,
  }))

  for (const row of rows) {
    const output: Record<string, unknown> = {}
    for (const column of columns) {
      output[String(column.key)] = parseCellValue(row[column.key as keyof T], column.kind)
    }
    worksheet.addRow(output)
  }

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    }
  })

  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }

  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1)

    if (column.kind === 'date') {
      excelColumn.numFmt = 'yyyy-mm-dd'
    }

    if (column.kind === 'datetime') {
      excelColumn.numFmt = 'yyyy-mm-dd hh:mm'
    }

    if (column.kind === 'multiline' || column.kind === 'path') {
      excelColumn.alignment = {
        wrapText: true,
        vertical: 'top',
      }
    }
  })

  worksheet.columns.forEach(column => {
    if (column.values) {
      let maxLen = 10
      for (const cellValue of column.values) {
        const len = cellValue == null ? 0 : String(cellValue).length
        maxLen = Math.max(maxLen, len)
      }
      const currentWidth = typeof column.width === 'number' ? column.width : 10
      column.width = Math.min(Math.max(currentWidth, maxLen + 2), 40)
    }
  })

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.alignment = { vertical: 'top' }
  })

  return worksheet
}

export async function buildViewExportWorkbook(data: ViewExportData): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Primap'
  workbook.created = new Date()

  addWorksheet(workbook, 'Summary', [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 14 },
  ], data.summaryRows)

  addWorksheet(workbook, 'Walks', [
    { header: 'Round Name', key: 'roundName', width: 24 },
    { header: 'Walk Date', key: 'walkDate', width: 16, kind: 'date' },
    { header: 'Location', key: 'location', width: 24 },
    { header: 'Start Time', key: 'startTime', width: 12 },
    { header: 'End Time', key: 'endTime', width: 12 },
    { header: 'Max Volunteers', key: 'maxVolunteers', width: 16 },
    { header: 'Joined Volunteers', key: 'joinedVolunteers', width: 18 },
    { header: 'Cancelled Volunteers', key: 'cancelledVolunteers', width: 18 },
    { header: 'Observation Count', key: 'observationCount', width: 18 },
    { header: 'Sighting Count', key: 'sightingCount', width: 16 },
    { header: 'Incident Count', key: 'incidentCount', width: 16 },
    { header: 'Media Count', key: 'mediaCount', width: 14 },
  ], data.walkRows)

  addWorksheet(workbook, 'Observations', [
    { header: 'Round Name', key: 'roundName', width: 24 },
    { header: 'Walk Date', key: 'walkDate', width: 16, kind: 'date' },
    { header: 'Location', key: 'location', width: 24 },
    { header: 'Observer Name', key: 'observerName', width: 22 },
    { header: 'Observer Email', key: 'observerEmail', width: 26 },
    { header: 'Observation Status', key: 'observationStatus', width: 18 },
    { header: 'Outcome', key: 'outcome', width: 16 },
    { header: 'Walk Completion', key: 'walkCompletion', width: 18 },
    { header: 'Observation Lat', key: 'observationLat', width: 16 },
    { header: 'Observation Lng', key: 'observationLng', width: 16 },
    { header: 'Notes', key: 'notes', width: 32, kind: 'multiline' },
    { header: 'Submitted At', key: 'submittedAt', width: 22, kind: 'datetime' },
    { header: 'Sighting Count', key: 'sightingCount', width: 16 },
    { header: 'Media Count', key: 'mediaCount', width: 14 },
    { header: 'Media Files', key: 'mediaFiles', width: 40, kind: 'path' },
  ], data.observationRows)

  addWorksheet(workbook, 'Sightings', [
    { header: 'Round Name', key: 'roundName', width: 24 },
    { header: 'Walk Date', key: 'walkDate', width: 16, kind: 'date' },
    { header: 'Location', key: 'location', width: 24 },
    { header: 'Observer Name', key: 'observerName', width: 22 },
    { header: 'Observer Email', key: 'observerEmail', width: 26 },
    { header: 'Species', key: 'species', width: 14 },
    { header: 'Count', key: 'count', width: 12 },
    { header: 'Sighting Lat', key: 'sightingLat', width: 16 },
    { header: 'Sighting Lng', key: 'sightingLng', width: 16 },
    { header: 'Observed At', key: 'observedAt', width: 22, kind: 'datetime' },
    { header: 'Sighting Notes', key: 'sightingNotes', width: 32, kind: 'multiline' },
    { header: 'Observation Outcome', key: 'observationOutcome', width: 20 },
    { header: 'Media Count', key: 'mediaCount', width: 14 },
    { header: 'Media Files', key: 'mediaFiles', width: 40, kind: 'path' },
  ], data.sightingRows)

  addWorksheet(workbook, 'Incidents', [
    { header: 'Round Name', key: 'roundName', width: 24 },
    { header: 'Walk Date', key: 'walkDate', width: 16, kind: 'date' },
    { header: 'Location', key: 'location', width: 24 },
    { header: 'Reported By Name', key: 'reportedByName', width: 22 },
    { header: 'Reported By Email', key: 'reportedByEmail', width: 26 },
    { header: 'Incident Type', key: 'incidentType', width: 20 },
    { header: 'Description', key: 'description', width: 32, kind: 'multiline' },
    { header: 'Lat', key: 'lat', width: 14 },
    { header: 'Lng', key: 'lng', width: 14 },
    { header: 'Resolved', key: 'resolved', width: 12 },
    { header: 'Resolved Notes', key: 'resolvedNotes', width: 28, kind: 'multiline' },
    { header: 'Created At', key: 'createdAt', width: 22, kind: 'datetime' },
  ], data.incidentRows)

  return await workbook.xlsx.writeBuffer()
}
