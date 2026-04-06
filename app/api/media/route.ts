import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const parentType = formData.get('parentType') as 'observation' | 'sighting'
  const parentId = formData.get('parentId') as string
  const exifLat = formData.get('exifLat') ? Number(formData.get('exifLat')) : null
  const exifLng = formData.get('exifLng') ? Number(formData.get('exifLng')) : null
  const exifDatetime = (formData.get('exifDatetime') as string) || null

  if (!file) return NextResponse.json({ error: 'No file provided' })
  if (!parentId) return NextResponse.json({ error: 'No parentId provided' })

  // Fetch configurable media limit
  const { data: settings } = await supabase
    .from('app_settings')
    .select('max_media_per_report')
    .limit(1)
    .single()
  const maxMedia = settings?.max_media_per_report ?? 10

  // Check current media count for this parent
  const column = parentType === 'observation' ? 'observation_id' : 'sighting_id'
  const { count, error: countError } = await supabase
    .from('media')
    .select('*', { count: 'exact', head: true })
    .eq(column, parentId)

  if (countError) {
    return NextResponse.json({ error: 'Failed to check media count' }, { status: 500 })
  }

  if ((count ?? 0) >= maxMedia) {
    return NextResponse.json(
      { error: `Maximum of ${maxMedia} media files allowed per report` },
      { status: 422 }
    )
  }

  const fileExt = file.name.split('.').pop()
  const filePath = `${user.id}/${parentId}/${crypto.randomUUID()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('observation-media')
    .upload(filePath, file)

  if (uploadError) return NextResponse.json({ error: uploadError.message })

  const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO'

  const { data, error: insertError } = await supabase
    .from('media')
    .insert({
      ...(parentType === 'observation'
        ? { observation_id: parentId }
        : { sighting_id: parentId }),
      file_path: filePath,
      file_name: file.name,
      media_type: mediaType,
      file_size: file.size,
      exif_lat: exifLat,
      exif_lng: exifLng,
      exif_datetime: exifDatetime,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message })

  return NextResponse.json({ success: true, media: data })
}
