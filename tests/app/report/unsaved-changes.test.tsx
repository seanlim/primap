import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useRouter } from 'next/navigation'
import { ObservationFormClient } from '@/app/(app)/report/[walkId]/edit/observation-form-client'
import { getDraft, putDraft } from '@/lib/offline/db'
import { saveDraft } from '@/lib/actions/observation-actions'

vi.mock('@/lib/actions/observation-actions', () => ({
  saveDraft: vi.fn(async () => ({ observationId: 'obs-1', sightingIds: [] })),
  getObservationMeta: vi.fn(async () => null),
  getObservationFull: vi.fn(async () => null),
  getMediaBySightingIds: vi.fn(async () => []),
  submitObservation: vi.fn(),
}))
vi.mock('@/lib/offline/db', () => ({
  getDraft: vi.fn(async () => null), putDraft: vi.fn(async () => {}), deleteDraft: vi.fn(),
  clearSyncStateForWalk: vi.fn(), getMediaByClientParent: vi.fn(async () => []), updateMediaResolvedParentId: vi.fn(),
}))
vi.mock('@/lib/offline/sync-engine', () => ({ processOutbox: vi.fn() }))
vi.mock('@/components/map/location-picker', () => ({ LocationPicker: () => null }))
vi.mock('@/components/report/media-uploader', () => ({ MediaUploader: () => null }))

const push = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  vi.mocked(getDraft).mockResolvedValue(null)
  vi.mocked(putDraft).mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function openEditor() {
  render(<><a href="/home">Go Home</a><ObservationFormClient slot={{ id: 'walk-1', locationName: 'Test', walkDate: '2026-10-25', startTime: '08:00', endTime: '10:00', roundName: 'Test' }} existingObservation={null} /></>)
  // Initialization establishes the baseline after its animation frame.
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
  return screen.getByPlaceholderText('Any additional observations or notes...')
}
function departure() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}
it('warns before immediate document departure, and stops warning after saving', async () => {
  const notes = await openEditor()
  expect(departure()).toBe(false)
  fireEvent.change(notes, { target: { value: 'new note' } })
  expect(departure()).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Synced')
  expect(departure()).toBe(false)
})
it('Stay preserves the edit and blocks a link; Leave permits navigation', async () => {
  const notes = await openEditor()
  fireEvent.change(notes, { target: { value: 'keep this note' } })
  fireEvent.click(screen.getByText('Go Home'))
  expect(window.confirm).toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
  expect(notes).toHaveValue('keep this note')
  vi.mocked(window.confirm).mockReturnValue(true)
  fireEvent.click(screen.getByText('Go Home'))
  await waitFor(() => expect(push).toHaveBeenCalledWith('/home'))
})
it('a delayed save does not clear the warning for a newer edit', async () => {
  const notes = await openEditor()
  let finish!: () => void
  vi.mocked(putDraft).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  fireEvent.change(notes, { target: { value: 'revision one' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await waitFor(() => expect(putDraft).toHaveBeenCalled())
  fireEvent.change(notes, { target: { value: 'revision two' } })
  await act(async () => finish())
  await screen.findByText('Synced')
  expect(vi.mocked(saveDraft).mock.calls.at(-1)?.[0].notes).toBe('revision one')
  expect(departure()).toBe(true)
})

it('Stay restores the editor after a history traversal and Leave lets it proceed', async () => {
  const notes = await openEditor()
  fireEvent.change(notes, { target: { value: 'history edit' } })
  const restoreEntry = vi.spyOn(window.history, 'pushState')
  const nextHandler = vi.fn()
  window.addEventListener('popstate', nextHandler)
  try {
    fireEvent(window, new PopStateEvent('popstate'))
    expect(window.confirm).toHaveBeenCalled()
    expect(restoreEntry).toHaveBeenCalled()
    expect(nextHandler).not.toHaveBeenCalled()
    expect(notes).toHaveValue('history edit')
    vi.mocked(window.confirm).mockReturnValue(true)
    fireEvent(window, new PopStateEvent('popstate'))
    expect(nextHandler).toHaveBeenCalledTimes(1)
  } finally {
    window.removeEventListener('popstate', nextHandler)
  }
})
it('keeps warning when the server rejects an otherwise locally saved revision', async () => {
  const notes = await openEditor()
  vi.mocked(saveDraft).mockResolvedValueOnce({ error: 'Try again later' })
  fireEvent.change(notes, { target: { value: 'local only' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Try again later')
  expect(departure()).toBe(true)
})
