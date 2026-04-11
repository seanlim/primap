import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { TABLE_ORDER, EXPORT_XLSX_FILENAME, MEDIA_DIR, BATCH_SIZE, type TableName } from '@/lib/export-import/constants'
import { parseWorkbookToTableData } from '@/lib/export-import/import-workbook'
import { uploadMediaFile } from '@/lib/export-import/media-helpers'
import type { TablesInsert } from '@/lib/types/database'

export const maxDuration = 300

interface TableSummary {
  inserted: number
  skipped: number
  errors: string[]
}

type ImportRow = Record<string, unknown>

function cleanImportRows(rows: ImportRow[]) {
  return rows.map(row => {
    const cleaned: ImportRow = {}
    for (const [key, val] of Object.entries(row)) {
      cleaned[key] = val === '' ? null : val
    }
    return cleaned
  })
}

async function upsertAppSettings(
  adminClient: ReturnType<typeof createAdminClient>,
  rows: ImportRow[]
): Promise<TableSummary> {
  const result: TableSummary = { inserted: 0, skipped: 0, errors: [] }
  if (rows.length === 0) return result

  const importedRow = rows[0]
  // Extract only data columns, not the id
  const { id: _importedId, ...dataColumns } = importedRow
  const cleanedData: ImportRow = {}
  for (const [key, val] of Object.entries(dataColumns)) {
    cleanedData[key] = val === '' ? null : val
  }

  // Check if a settings row already exists
  const { data: existing } = await adminClient
    .from('app_settings')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Update existing singleton row
    const { error } = await adminClient
      .from('app_settings')
      .update(cleanedData)
      .eq('id', existing.id)

    if (error) {
      result.errors.push(error.message)
    } else {
      result.inserted = 1
    }
  } else {
    // No existing row — insert the imported one (with its original id)
    const cleanedRow: ImportRow = {}
    for (const [key, val] of Object.entries(importedRow)) {
      cleanedRow[key] = val === '' ? null : val
    }
    const { error } = await adminClient
      .from('app_settings')
      .insert(cleanedRow)

    if (error) {
      result.errors.push(error.message)
    } else {
      result.inserted = 1
    }
  }

  return result
}

export async function POST(request: NextRequest) {
  // Auth: verify admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Parse zip
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Find XLSX file
    const xlsxFile = zip.file(EXPORT_XLSX_FILENAME)
    if (!xlsxFile) {
      return NextResponse.json(
        { error: `Zip must contain ${EXPORT_XLSX_FILENAME}` },
        { status: 400 }
      )
    }

    const xlsxBuffer = Buffer.from(await xlsxFile.async('arraybuffer'))
    const tableData = await parseWorkbookToTableData(xlsxBuffer)

    const adminClient = createAdminClient()
    const summary: Record<string, TableSummary> = {}

    // Insert data in FK-dependency order, deferring media until blobs are uploaded
    for (const table of TABLE_ORDER) {
      // Skip media — handled after blob upload below
      if (table === 'media') continue

      const rows = tableData[table]
      if (!rows || rows.length === 0) {
        summary[table] = { inserted: 0, skipped: 0, errors: [] }
        continue
      }

      // Special-case app_settings: update existing singleton instead of upserting by id
      if (table === 'app_settings') {
        summary[table] = await upsertAppSettings(adminClient, rows)
        continue
      }

      const tableSummary: TableSummary = { inserted: 0, skipped: 0, errors: [] }

      // Process in batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)

        // Clean rows: remove empty string values for nullable fields, keep nulls
        const cleanedBatch = cleanImportRows(batch)
        const tableClient = adminClient.from(table) as unknown as {
          upsert: (values: unknown[], options: { onConflict: string; ignoreDuplicates: boolean }) => {
            select: (columns: string) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>
          }
        }

        const { data, error } = await tableClient
          .upsert(cleanedBatch as TablesInsert<TableName>[], { onConflict: 'id', ignoreDuplicates: true })
          .select('id')

        if (error) {
          tableSummary.errors.push(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`
          )
        } else {
          const insertedCount = data?.length ?? 0
          tableSummary.inserted += insertedCount
          tableSummary.skipped += batch.length - insertedCount
        }
      }

      summary[table] = tableSummary
    }

    // Upload media blobs from zip BEFORE inserting media DB rows
    const mediaSummary = { uploaded: 0, skipped: 0, errors: [] as string[] }
    const uploadedPaths = new Set<string>()
    const mediaFolder = zip.folder(MEDIA_DIR)

    if (mediaFolder) {
      const mediaFiles: { path: string; file: JSZip.JSZipObject }[] = []
      mediaFolder.forEach((relativePath, file) => {
        if (!file.dir) {
          mediaFiles.push({ path: relativePath, file })
        }
      })

      for (const { path, file } of mediaFiles) {
        const fileData = await file.async('uint8array')
        const { error, skipped } = await uploadMediaFile(adminClient, path, fileData)

        if (error) {
          mediaSummary.errors.push(`${path}: ${error}`)
        } else {
          uploadedPaths.add(path)
          if (skipped) {
            mediaSummary.skipped++
          } else {
            mediaSummary.uploaded++
          }
        }
      }
    }

    // Now insert media DB rows, only for files that were successfully uploaded or already existed
    const mediaRows = tableData['media']
    const mediaTableSummary: TableSummary = { inserted: 0, skipped: 0, errors: [] }

    if (mediaRows && mediaRows.length > 0) {
      // Filter to only rows whose file_path has a corresponding blob
      const eligibleRows = uploadedPaths.size > 0
        ? mediaRows.filter(row => {
            const filePath = String(row.file_path ?? '')
            return uploadedPaths.has(filePath)
          })
        : mediaRows // If no media folder in zip, still attempt upsert (re-import on same env)

      const skippedMediaRows = mediaRows.length - eligibleRows.length
      mediaTableSummary.skipped += skippedMediaRows

      for (let i = 0; i < eligibleRows.length; i += BATCH_SIZE) {
        const batch = eligibleRows.slice(i, i + BATCH_SIZE)
        const cleanedBatch = cleanImportRows(batch)

        const { data, error } = await adminClient
          .from('media')
          .upsert(cleanedBatch as TablesInsert<'media'>[], { onConflict: 'id', ignoreDuplicates: true })
          .select('id')

        if (error) {
          mediaTableSummary.errors.push(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`
          )
        } else {
          const insertedCount = data?.length ?? 0
          mediaTableSummary.inserted += insertedCount
          mediaTableSummary.skipped += batch.length - insertedCount
        }
      }
    }

    summary['media'] = mediaTableSummary

    const hasMediaErrors = mediaSummary.errors.length > 0
    const hasTableErrors = Object.values(summary).some(s => s.errors.length > 0)

    return NextResponse.json({
      success: !hasMediaErrors && !hasTableErrors,
      ...((hasMediaErrors || hasTableErrors) && { partial: true }),
      summary: {
        ...summary,
        media_files: mediaSummary,
      },
    })
  } catch (err) {
    console.error('Import failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    )
  }
}
