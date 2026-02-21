import exifr from 'exifr'

interface ExifData {
  lat: number | null
  lng: number | null
  datetime: string | null
}

export async function extractExifData(file: File): Promise<ExifData> {
  const result: ExifData = { lat: null, lng: null, datetime: null }

  // Skip video files
  if (file.type.startsWith('video/')) return result

  try {
    const gps = await exifr.gps(file)
    if (gps?.latitude && gps?.longitude) {
      result.lat = gps.latitude
      result.lng = gps.longitude
    }
  } catch {
    // GPS extraction failed, continue
  }

  try {
    const parsed = await exifr.parse(file, ['DateTimeOriginal'])
    if (parsed?.DateTimeOriginal) {
      const dt = parsed.DateTimeOriginal
      if (dt instanceof Date) {
        result.datetime = dt.toISOString().slice(0, 16) // format for datetime-local input
      }
    }
  } catch {
    // Date extraction failed, continue
  }

  return result
}
