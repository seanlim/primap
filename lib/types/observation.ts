import { type MediaItem } from '@/components/report/media-uploader'

export interface SightingForm {
  id?: string
  clientTempId: string
  species: 'RBL' | 'LTM' | 'DUSKY' | 'OTHER' | ''
  speciesOther: string
  count: string
  observedAt: string
  lat: number | null
  lng: number | null
  notes: string
  media: MediaItem[]
}

export interface OfflineDraftInput {
  observationId?: string
  walkCompletion: 'COMPLETED' | 'PARTIAL' | 'ABORTED'
  completionComment?: string
  outcome: 'SIGHTED' | 'NOT_SIGHTED'
  notes?: string
  lat?: number
  lng?: number
  clientDraftId?: string
  sightings?: SightingForm[]
}

export interface QueuedMedia {
  id: string
  clientParentId: string
  parentType: 'observation' | 'sighting'
  resolvedParentId: string | null
  blob: Blob
  fileName: string
  fileSize: number
  mediaType: 'PHOTO' | 'VIDEO'
  exifLat: number | null
  exifLng: number | null
  exifDatetime: string | null
  createdAt: number
}
