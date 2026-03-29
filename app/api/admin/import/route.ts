import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { TABLE_ORDER, EXPORT_XLSX_FILENAME, MEDIA_DIR, BATCH_SIZE, type TableName } from '@/lib/export-import/constants'
import { parseWorkbookToTableData } from '@/lib/export-import/import-workbook'
import { uploadMediaFile } from '@/lib/export-import/media-helpers'

export const maxDuration = 300

interface TableSummary {
  inserted: number
  skipped: number
  errors: string[]
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

    // Insert data in FK-dependency order
    for (const table of TABLE_ORDER) {
      const rows = tableData[table]
      if (!rows || rows.length === 0) {
        summary[table] = { inserted: 0, skipped: 0, errors: [] }
        continue
      }

      const tableSummary: TableSummary = { inserted: 0, skipped: 0, errors: [] }

      // Process in batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)

        // Clean rows: remove empty string values for nullable fields, keep nulls
        const cleanedBatch = batch.map(row => {
          const cleaned: Record<string, unknown> = {}
          for (const [key, val] of Object.entries(row)) {
            // Keep null as null, convert empty strings to null
            cleaned[key] = val === '' ? null : val
          }
          return cleaned
        })

        const { data, error } = await adminClient
          .from(table)
          .upsert(cleanedBatch, { onConflict: 'id', ignoreDuplicates: true })
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

    // Upload media files from zip
    const mediaSummary = { uploaded: 0, skipped: 0, errors: [] as string[] }
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
        } else if (skipped) {
          mediaSummary.skipped++
        } else {
          mediaSummary.uploaded++
        }
      }
    }

    return NextResponse.json({
      success: true,
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
