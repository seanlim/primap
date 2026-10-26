import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { IncidentModal } from '@/app/(app)/report/[walkId]/incident-modal'

vi.mock('@/lib/actions/incident-actions', () => ({ reportIncident: vi.fn(async () => ({ incidentId: 'incident-1' })) }))
vi.mock('@/lib/actions/observation-actions', () => ({ deleteMedia: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/utils/exif', () => ({ extractExifData: vi.fn(async () => ({})) }))
vi.mock('@/lib/offline/db', () => ({
  getMediaByClientParent: vi.fn(async () => []), saveMediaToQueue: vi.fn(), removeMediaFromQueue: vi.fn(), addToOutbox: vi.fn(),
}))
vi.mock('@/components/report/use-media-urls', () => ({
  useMediaUrls: (media: { id: string }[]) => Object.fromEntries(media.map(m => [m.id, `/photos/${m.id}.png`])),
}))
beforeEach(() => vi.clearAllMocks())
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('retains incident previews through upload progress rerenders, accumulates files, and updates after deletion', async () => {
  const onSubmitted = vi.fn()
  const props = { walkId: 'walk-1', onClose: vi.fn(), onSubmitted }
  const { rerender } = render(<IncidentModal {...props} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'OTHER' } })
  fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), { target: { value: 'Synthetic incident' } })
  fireEvent.click(screen.getByRole('button', { name: 'Report' }))
  await screen.findByRole('heading', { name: 'Add Photos' })
  const fetchMock = vi.spyOn(globalThis, 'fetch')

  for (let i = 1; i <= 2; i++) {
    let finish!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['photo'], `incident-${i}.png`, { type: 'image/png' })] } })
    await screen.findByText(/Uploading 1 file/)
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled()
    fireEvent.click(screen.getByTestId('incident-modal-root').firstElementChild!)
    expect(onSubmitted).not.toHaveBeenCalled()
    await act(async () => finish(new Response(JSON.stringify({ success: true, media: {
      id: `media-${i}`, file_path: `path-${i}`, file_name: `incident-${i}.png`, media_type: 'PHOTO',
    } }))))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled())
    expect(screen.getByText(`${i}/10`)).toBeInTheDocument()
    expect(screen.getByAltText(`incident-${i}.png`)).toBeInTheDocument()
  }
  rerender(<IncidentModal {...props} />)
  expect(screen.getByText('2/10')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Remove incident-1.png' }))
  await screen.findByText('1/10')
  expect(screen.queryByAltText('incident-1.png')).not.toBeInTheDocument()
  expect(screen.getByAltText('incident-2.png')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(onSubmitted).toHaveBeenCalledTimes(1)
})
