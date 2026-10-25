import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_MAX_MEDIA_PER_REPORT } from '@/lib/constants/settings'
import {
  OBSERVATION_MEDIA_BUCKET,
  INCIDENT_MEDIA_BUCKET,
  type MediaBucket,
} from '@/lib/utils/storage'

import { isSupportedMediaType, UNSUPPORTED_MEDIA_MESSAGE } from '@/lib/constants/media'

type ParentType = 'observation' | 'sighting' | 'incident'

const PARENT_BUCKET: Record<ParentType, MediaBucket> = {
  observation: OBSERVATION_MEDIA_BUCKET,
  sighting: OBSERVATION_MEDIA_BUCKET,
  incident: INCIDENT_MEDIA_BUCKET,
}

function isParentType(value: unknown): value is ParentType {
  return value === 'observation' || value === 'sighting' || value === 'incident'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const parentTypeRaw = formData.get('parentType')
  const parentId = formData.get('parentId') as string
  const exifLat = formData.get('exifLat') ? Number(formData.get('exifLat')) : null
  const exifLng = formData.get('exifLng') ? Number(formData.get('exifLng')) : null
  const exifDatetime = (formData.get('exifDatetime') as string) || null

  if (!file) return NextResponse.json({ error: 'No file provided' })
  if (!parentId) return NextResponse.json({ error: 'No parentId provided' })
  if (!isParentType(parentTypeRaw)) {
    return NextResponse.json({ error: 'Invalid parentType' }, { status: 400 })
  }
  if (!isSupportedMediaType(file.type)) {
    return NextResponse.json({ error: UNSUPPORTED_MEDIA_MESSAGE }, { status: 415 })
  }
  const parentType: ParentType = parentTypeRaw
  const bucket = PARENT_BUCKET[parentType]

  // Fetch configurable media limit
  const { data: settings } = await supabase
    .from('app_settings')
    .select('max_media_per_report')
    .limit(1)
    .single()
  const maxMedia = settings?.max_media_per_report ?? DEFAULT_MAX_MEDIA_PER_REPORT

  // Use the same aggregate as the database trigger, including sibling sightings.
  const { data: count, error: countError } = await supabase.rpc('get_report_media_count', {
    p_parent_type: parentType,
    p_parent_id: parentId,
  })

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
    .from(bucket)
    .upload(filePath, file)

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO'

  const insertPayload: {
    file_path: string
    file_name: string
    media_type: 'PHOTO' | 'VIDEO'
    file_size: number
    exif_lat: number | null
    exif_lng: number | null
    exif_datetime: string | null
    observation_id?: string
    sighting_id?: string
    incident_id?: string
  } = {
    file_path: filePath,
    file_name: file.name,
    media_type: mediaType,
    file_size: file.size,
    exif_lat: exifLat,
    exif_lng: exifLng,
    exif_datetime: exifDatetime,
  }
  if (parentType === 'observation') insertPayload.observation_id = parentId
  else if (parentType === 'sighting') insertPayload.sighting_id = parentId
  else insertPayload.incident_id = parentId

  const { data, error: insertError } = await supabase
    .from('media')
    .insert(insertPayload)
    .select()
    .single()

  if (insertError) {
    // The DB trigger `enforce_max_media_per_report_trigger` is the source of
    // truth for the limit and serializes concurrent inserts per report.
    // The pre-check above is only an optimization; if two requests race past
    // it, one will land here with the trigger's RAISE EXCEPTION message.
    // Either way, the storage object we just uploaded must be cleaned up.
    await supabase.storage
      .from(bucket)
      .remove([filePath])
      .catch(() => {})

    if (insertError.message?.includes('media files allowed per report')) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 422 }
      )
    }
    return NextResponse.json({ error: insertError.message })
  }

  return NextResponse.json({ success: true, media: data })
}
