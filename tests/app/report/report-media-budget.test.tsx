import { render, screen, cleanup } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { ObservationFormClient } from '@/app/(app)/report/[walkId]/edit/observation-form-client'
import { getMediaByClientParent } from '@/lib/offline/db'

vi.mock('@/lib/actions/observation-actions', () => ({
  saveDraft: vi.fn(), submitObservation: vi.fn(), deleteMedia: vi.fn(),
  getObservationMeta: vi.fn(async () => null), getObservationFull: vi.fn(async () => null), getMediaBySightingIds: vi.fn(async () => []),
}))
vi.mock('@/lib/offline/db', () => ({
  getDraft: vi.fn(async () => null), putDraft: vi.fn(async () => {}), deleteDraft: vi.fn(),
  getMediaByClientParent: vi.fn(async () => []), clearSyncStateForWalk: vi.fn(), updateMediaResolvedParentId: vi.fn(),
}))
vi.mock('@/lib/offline/sync-engine', () => ({ processOutbox: vi.fn() }))
vi.mock('@/components/map/location-picker', () => ({ LocationPicker: () => null }))
vi.mock('@/components/report/use-media-urls', () => ({ useMediaUrls: () => ({}) }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMediaByClientParent).mockResolvedValue([])
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const media = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, file_path: `${prefix}-${i}.png`, file_name: `${prefix}-${i}.png`, media_type: 'PHOTO' }))
function openReport(observationCount: number) {
  render(<ObservationFormClient maxMediaPerReport={10} slot={{ id: 'walk-1', locationName: 'Test', walkDate: '2026-10-25', startTime: '08:00', endTime: '10:00', roundName: 'Test' }} existingObservation={{
    id: 'obs-1', walkCompletion: 'COMPLETED', completionComment: null, outcome: 'SIGHTED', notes: null, lat: null, lng: null, serverUpdatedAt: '2026-10-25', media: media('obs', observationCount),
    sightings: ['a', 'b'].map(id => ({ id, species: 'RBL', speciesOther: null, count: '1', observedAt: null, lat: 1, lng: 103, notes: null, media: media(id, 2) })),
  }} />)
}
it('counts hidden observation media together with both sightings on reload', async () => {
  openReport(6)
  expect(await screen.findAllByText('10/10 in report')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Add Photos' })).not.toBeInTheDocument()
})
it('includes queued media for the hidden observation in the shared allowance', async () => {
  vi.mocked(getMediaByClientParent).mockImplementation(async id => id === 'obs-1' ? [
    { id: 'q', clientParentId: id, parentType: 'observation', resolvedParentId: id, blob: new Blob(['photo']), fileName: 'queued.png', fileSize: 5, mediaType: 'PHOTO', exifLat: null, exifLng: null, exifDatetime: null, createdAt: Date.now() },
  ] : [])
  openReport(5)
  expect(await screen.findAllByText('10/10 in report')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'Add Photos' })).not.toBeInTheDocument()
})
