import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { TABLE_ORDER, EXPORT_XLSX_FILENAME, MEDIA_DIR, type TableName } from '@/lib/export-import/constants'
import { fetchAllRows, downloadMediaFile } from '@/lib/export-import/media-helpers'
import { buildExportWorkbook } from '@/lib/export-import/export-workbook'
import { INCIDENT_MEDIA_BUCKET, OBSERVATION_MEDIA_BUCKET } from '@/lib/utils/storage'

export const maxDuration = 300

export async function GET() {
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
    const adminClient = createAdminClient()

    // Fetch all table data
    const tableData = {} as Record<TableName, Record<string, unknown>[]>
    for (const table of TABLE_ORDER) {
      tableData[table] = await fetchAllRows(adminClient, table)
    }

    // Build XLSX workbook
    const xlsxBuffer = await buildExportWorkbook(tableData)

    // Create zip
    const zip = new JSZip()
    zip.file(EXPORT_XLSX_FILENAME, xlsxBuffer)

    // Download and add media files
    const mediaRows = tableData.media
    const mediaWarnings: string[] = []

    for (const row of mediaRows) {
      const filePath = row.file_path as string
      if (!filePath) continue
      const bucket = row.incident_id ? INCIDENT_MEDIA_BUCKET : OBSERVATION_MEDIA_BUCKET

      const { data, error } = await downloadMediaFile(adminClient, filePath, bucket)
      if (error || !data) {
        mediaWarnings.push(`Skipped ${filePath}: ${error ?? 'no data'}`)
        continue
      }
      zip.file(`${MEDIA_DIR}/${filePath}`, data)
    }

    if (mediaWarnings.length > 0) {
      zip.file('export-warnings.txt', mediaWarnings.join('\n'))
    }

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="primap-export-${date}.zip"`,
      },
    })
  } catch (err) {
    console.error('Export failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    )
  }
}
