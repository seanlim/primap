import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useRouter } from 'next/navigation'
import { ObservationFormClient } from '@/app/(app)/report/[walkId]/edit/observation-form-client'

vi.mock('@/lib/actions/observation-actions', () => ({
  saveDraft: vi.fn(async () => ({ observationId: 'obs-1', sightingIds: [] })),
  getObservationMeta: vi.fn(async () => null), getObservationFull: vi.fn(async () => null),
  getMediaBySightingIds: vi.fn(async () => []), submitObservation: vi.fn(), deleteMedia: vi.fn(),
}))
vi.mock('@/lib/offline/db', () => ({
  getDraft: vi.fn(async () => null), putDraft: vi.fn(async () => {}), deleteDraft: vi.fn(),
  clearSyncStateForWalk: vi.fn(), getMediaByClientParent: vi.fn(async () => []), updateMediaResolvedParentId: vi.fn(),
}))
vi.mock('@/lib/offline/sync-engine', () => ({ processOutbox: vi.fn() }))
vi.mock('@/components/map/location-picker', () => ({ LocationPicker: () => null }))
vi.mock('@/components/report/use-media-urls', () => ({ useMediaUrls: () => ({}) }))
vi.mock('@/lib/utils/exif', () => ({ extractExifData: vi.fn(async () => ({})) }))

const push = vi.fn()
let finish: ((response: Response) => void)[]
beforeEach(() => {
  vi.clearAllMocks()
  finish = []
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish.push(resolve) })))
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function openEditor(sightingCount = 0) {
  const { container } = render(<><a href="/home">Go Home</a><ObservationFormClient
    slot={{ id: 'walk-1', locationName: 'Test', walkDate: '2026-10-25', startTime: '08:00', endTime: '10:00', roundName: 'Test' }}
    existingObservation={{
      id: 'obs-1', walkCompletion: 'PARTIAL', completionComment: null, outcome: sightingCount ? 'SIGHTED' : 'NOT_SIGHTED',
      notes: null, lat: null, lng: null, serverUpdatedAt: '2026-10-25', media: [],
      sightings: Array.from({ length: sightingCount }, (_, i) => ({
        id: `sighting-${i}`, species: 'RBL', speciesOther: null, count: '1', observedAt: null,
        lat: 1, lng: 103, notes: null, media: [],
      })),
    }}
  /></>)
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
  await screen.findAllByRole('button', { name: 'Add Photos' })
  return container.querySelectorAll<HTMLInputElement>('input[type=file]')
}
function departure() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}
function selectPhoto(input: HTMLInputElement, name = 'photo.png') {
  fireEvent.change(input, { target: { files: [new File(['photo'], name, { type: 'image/png' })] } })
}
async function completeUpload(index: number) {
  await act(async () => finish[index](Response.json({ success: true, media: {
    id: `media-${index}`, file_path: `photo-${index}.png`, file_name: `photo-${index}.png`, media_type: 'PHOTO',
  } })))
}

it.each([0, 1])('protects clean report navigation while an upload is pending (%i sightings)', async count => {
  const inputs = await openEditor(count)
  expect(departure()).toBe(false)
  selectPhoto(inputs[0])
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(departure()).toBe(true)
  fireEvent.click(screen.getByText('Go Home'))
  expect(window.confirm).toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Synced')
  expect(departure()).toBe(true)

  await completeUpload(0)
  await waitFor(() => expect(departure()).toBe(false))
  vi.mocked(window.confirm).mockClear()
  fireEvent.click(screen.getByText('Go Home'))
  expect(window.confirm).not.toHaveBeenCalled()
})
it('keeps the guard until uploads in both sibling sightings finish', async () => {
  const inputs = await openEditor(2)
  selectPhoto(inputs[0], 'first.png')
  selectPhoto(inputs[1], 'second.png')
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(departure()).toBe(true)
  await completeUpload(0)
  expect(departure()).toBe(true)
  await completeUpload(1)
  await waitFor(() => expect(departure()).toBe(false))
})
it('clears the pending-upload guard when the server rejects the file', async () => {
  const inputs = await openEditor()
  selectPhoto(inputs[0])
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(departure()).toBe(true)
  await act(async () => finish[0](Response.json({ error: 'Upload rejected' }, { status: 422 })))
  await screen.findByText('Upload rejected')
  expect(departure()).toBe(false)
})
it('protects a removed sighting upload until its request settles', async () => {
  const inputs = await openEditor(2)
  selectPhoto(inputs[0])
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(departure()).toBe(true)
  fireEvent.click(screen.getByText('Sighting #1').parentElement!.querySelector('button')!)
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Synced')
  expect(departure()).toBe(true)
  await completeUpload(0)
  await waitFor(() => expect(departure()).toBe(false))
})
it('protects an observation upload after adding and saving a sighting', async () => {
  const inputs = await openEditor()
  selectPhoto(inputs[0])
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: 'Add Sighting' }))
  await act(async () => { fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'RBL' } }) })
  fireEvent.click(await screen.findByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Synced')
  expect(departure()).toBe(true)
  await completeUpload(0)
  await waitFor(() => expect(departure()).toBe(false))
})
it('keeps a remounted uploader protected when an older instance finishes first', async () => {
  const inputs = await openEditor()
  selectPhoto(inputs[0], 'older.png')
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: 'Add Sighting' }))
  await act(async () => { fireEvent.change(screen.getByRole('combobox'), { target: { value: 'RBL' } }) })
  await screen.findByRole('button', { name: 'Save Draft' })
  fireEvent.click(screen.getByText('Sighting #1').parentElement!.querySelector('button')!)
  await screen.findByRole('button', { name: 'Add Photos' })
  selectPhoto(document.querySelector<HTMLInputElement>('input[type=file]')!, 'newer.png')
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Synced')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled())
  await completeUpload(0)
  expect(departure()).toBe(true)
  await completeUpload(1)
  await waitFor(() => expect(departure()).toBe(false))
})
