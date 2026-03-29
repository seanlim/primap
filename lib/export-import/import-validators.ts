import { SupabaseClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import {
  LEGACY_REQUIRED_COLUMNS,
  VALID_SPECIES,
  VALID_OUTCOMES,
  VALID_WALK_COMPLETIONS,
} from './constants'
import { parseSheetRows } from './import-workbook'

export interface ValidationError {
  row: number
  column?: string
  message: string
}

export async function validateLegacyWorkbook(
  buffer: Buffer | ArrayBuffer,
  adminClient: SupabaseClient
): Promise<{ rows: Record<string, unknown>[]; errors: ValidationError[] }> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ArrayBuffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    return { rows: [], errors: [{ row: 0, message: 'No worksheet found in file' }] }
  }

  // Validate headers
  const headerRow = worksheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim().toLowerCase()
  })

  const headerErrors = validateHeaders(headers)
  if (headerErrors.length > 0) {
    return { rows: [], errors: headerErrors }
  }

  // Parse rows
  const rows = parseSheetRows(worksheet)
  if (rows.length === 0) {
    return { rows: [], errors: [{ row: 0, message: 'No data rows found' }] }
  }

  // Normalize keys to lowercase
  const normalizedRows = rows.map(row => {
    const normalized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(row)) {
      normalized[key.toLowerCase()] = val
    }
    return normalized
  })

  // Pre-fetch existing emails for validation
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('email')

  const existingEmails = new Set(
    (profiles ?? []).map(p => (p.email as string).toLowerCase())
  )

  // Pre-fetch existing round names
  const { data: rounds } = await adminClient
    .from('survey_rounds')
    .select('name')

  const existingRounds = new Set(
    (rounds ?? []).map(r => r.name as string)
  )

  // Validate each row
  const errors: ValidationError[] = []
  for (let i = 0; i < normalizedRows.length; i++) {
    const rowErrors = validateLegacyRow(normalizedRows[i], i + 2, existingEmails, existingRounds)
    errors.push(...rowErrors)
  }

  return { rows: normalizedRows, errors }
}

function validateHeaders(headers: string[]): ValidationError[] {
  const errors: ValidationError[] = []
  const headerSet = new Set(headers.filter(Boolean))

  for (const required of LEGACY_REQUIRED_COLUMNS) {
    if (!headerSet.has(required)) {
      errors.push({
        row: 1,
        column: required,
        message: `Missing required column: "${required}"`,
      })
    }
  }

  return errors
}

function validateLegacyRow(
  row: Record<string, unknown>,
  rowNumber: number,
  existingEmails: Set<string>,
  existingRounds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = []

  // Required fields
  for (const col of LEGACY_REQUIRED_COLUMNS) {
    const val = row[col]
    if (val === null || val === undefined || String(val).trim() === '') {
      errors.push({ row: rowNumber, column: col, message: `"${col}" is required` })
    }
  }

  // Enum validation
  const outcome = String(row.outcome ?? '').toUpperCase()
  if (outcome && !VALID_OUTCOMES.includes(outcome as typeof VALID_OUTCOMES[number])) {
    errors.push({
      row: rowNumber,
      column: 'outcome',
      message: `Invalid outcome: "${row.outcome}". Expected: ${VALID_OUTCOMES.join(', ')}`,
    })
  }

  const walkCompletion = String(row.walk_completion ?? '').toUpperCase()
  if (walkCompletion && !VALID_WALK_COMPLETIONS.includes(walkCompletion as typeof VALID_WALK_COMPLETIONS[number])) {
    errors.push({
      row: rowNumber,
      column: 'walk_completion',
      message: `Invalid walk_completion: "${row.walk_completion}". Expected: ${VALID_WALK_COMPLETIONS.join(', ')}`,
    })
  }

  // If SIGHTED, species is required
  if (outcome === 'SIGHTED') {
    const species = String(row.species ?? '').toUpperCase()
    if (!species) {
      errors.push({
        row: rowNumber,
        column: 'species',
        message: 'Species is required when outcome is SIGHTED',
      })
    } else if (!VALID_SPECIES.includes(species as typeof VALID_SPECIES[number])) {
      errors.push({
        row: rowNumber,
        column: 'species',
        message: `Invalid species: "${row.species}". Expected: ${VALID_SPECIES.join(', ')}`,
      })
    }
  }

  // Email must exist
  const email = String(row.observer_email ?? '').toLowerCase().trim()
  if (email && !existingEmails.has(email)) {
    errors.push({
      row: rowNumber,
      column: 'observer_email',
      message: `Observer email "${row.observer_email}" not found in profiles`,
    })
  }

  // Round must exist
  const roundName = String(row.round_name ?? '').trim()
  if (roundName && !existingRounds.has(roundName)) {
    errors.push({
      row: rowNumber,
      column: 'round_name',
      message: `Round "${roundName}" not found. Create the round first.`,
    })
  }

  // Date format validation
  const walkDate = String(row.walk_date ?? '').trim()
  if (walkDate && isNaN(Date.parse(walkDate))) {
    errors.push({
      row: rowNumber,
      column: 'walk_date',
      message: `Invalid date format: "${walkDate}". Use YYYY-MM-DD.`,
    })
  }

  // Lat/lng validation
  for (const field of ['observation_lat', 'observation_lng', 'sighting_lat', 'sighting_lng']) {
    const val = row[field]
    if (val !== null && val !== undefined && val !== '' && isNaN(Number(val))) {
      errors.push({
        row: rowNumber,
        column: field,
        message: `"${field}" must be a number, got "${val}"`,
      })
    }
  }

  return errors
}
