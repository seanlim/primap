import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { TABLE_ORDER, type TableName } from '@/lib/export-import/constants'
import { fetchAllRows, downloadMediaFile } from '@/lib/export-import/media-helpers'
import { buildViewExportData } from '@/lib/export-import/build-view-export-data'
import { buildViewExportWorkbook } from '@/lib/export-import/build-view-export-workbook'

export const maxDuration = 300

export async function GET() {
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
    const tableData = {} as Record<TableName, Record<string, unknown>[]>

    for (const table of TABLE_ORDER) {
      tableData[table] = await fetchAllRows(adminClient, table)
    }

    const viewExportData = buildViewExportData(tableData)
    const workbookBuffer = await buildViewExportWorkbook(viewExportData)

    const zip = new JSZip()
    zip.file('primap-view.xlsx', workbookBuffer)

    const mediaWarnings: string[] = []
    for (const item of viewExportData.mediaManifest) {
      const { data, error } = await downloadMediaFile(adminClient, item.storagePath)
      if (error || !data) {
        mediaWarnings.push(`Skipped ${item.storagePath}: ${error ?? 'no data'}`)
        continue
      }
      zip.file(item.zipPath, Buffer.from(data))
    }

    if (mediaWarnings.length > 0) {
      zip.file('export-warnings.txt', mediaWarnings.join('\n'))
    }

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="primap-view-export-${date}.zip"`,
        'X-Export-Warning-Count': String(mediaWarnings.length),
      },
    })
  } catch (err) {
    console.error('View export failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'View export failed' },
      { status: 500 }
    )
  }
}
