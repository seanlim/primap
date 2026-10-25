import 'fake-indexeddb/auto'
import * as offlineDb from '@/lib/offline/db'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { ObservationFormClient } from '@/app/(app)/report/[walkId]/edit/observation-form-client'
import { putDraft, saveMediaToQueue, addToOutbox, getOutboxItems, getQueuedMediaById } from '@/lib/offline/db'

vi.mock('@/lib/actions/observation-actions', () => ({
  saveDraft: vi.fn(async () => ({ observationId: 'obs-1', sightingIds: [], serverUpdatedAt: '2026-10-25' })),
  getObservationMeta: vi.fn(async () => null),
  getObservationFull: vi.fn(async () => ({ media: [{ id: 'media-1', file_name: 'synced.png' }] })),
  getMediaBySightingIds: vi.fn(async () => []),
  submitObservation: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn(() => ({})) }))
vi.mock('@/components/map/location-picker', () => ({ LocationPicker: () => null }))
vi.mock('@/components/report/media-uploader', () => ({
  MediaUploader: ({ existingMedia }: { existingMedia: { id: string; file_name: string }[] }) => (
    <div>{existingMedia.map(m => <span key={m.id}>{m.file_name}</span>)}</div>
  ),
}))

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('reconnect retains a failed photo and uploads it on the next reconnect, refreshing observation media', async () => {
  await putDraft('walk-sync', {
    observationId: 'obs-1', clientDraftId: 'obs-1', walkCompletion: 'PARTIAL', outcome: 'NOT_SIGHTED', sightings: [], notes: 'offline note',
  })
  await saveMediaToQueue({
    id: 'queued-1', clientParentId: 'obs-1', parentType: 'observation', resolvedParentId: 'obs-1',
    blob: new Blob(['photo'], { type: 'image/png' }), fileName: 'offline.png', fileSize: 5,
    mediaType: 'PHOTO', exifLat: null, exifLng: null, exifDatetime: null, createdAt: Date.now(),
  })
  await addToOutbox('UPLOAD_MEDIA', { mediaQueueId: 'queued-1' }, 'obs-1')
  // fake-indexeddb uses Node structuredClone, which cannot preserve jsdom Blobs.
  const readQueuedMedia = offlineDb.getQueuedMediaById
  vi.spyOn(offlineDb, 'getQueuedMediaById').mockImplementation(async id => {
    const item = await readQueuedMedia(id)
    return item ? { ...item, blob: new Blob(['photo'], { type: 'image/png' }) } : item
  })
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection lost'))
  render(<ObservationFormClient slot={{ id: 'walk-sync', locationName: 'Test', walkDate: '2026-10-25', startTime: '08:00', endTime: '10:00', roundName: 'Test' }} existingObservation={null} />)
  await screen.findByDisplayValue('offline note')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  fireEvent(window, new Event('online'))
  await waitFor(async () => expect((await getOutboxItems())[0]?.retries).toBe(1))
  await screen.findByText(/Failed to sync/)
  expect(await getQueuedMediaById('queued-1')).toBeDefined()
  expect(screen.queryByText('Synced')).not.toBeInTheDocument()

  fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })))
  fireEvent(window, new Event('offline'))
  fireEvent(window, new Event('online'))
  await waitFor(async () => expect(await getOutboxItems()).toHaveLength(0))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(await getQueuedMediaById('queued-1')).toBeUndefined()
  await screen.findByText('synced.png')
})
