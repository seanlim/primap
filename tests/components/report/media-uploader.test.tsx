import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { MediaUploader } from '@/components/report/media-uploader'
import { saveMediaToQueue, addToOutbox } from '@/lib/offline/db'

vi.mock('@/lib/actions/observation-actions', () => ({ deleteMedia: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/utils/exif', () => ({ extractExifData: vi.fn(async () => ({})) }))
vi.mock('@/lib/offline/db', () => ({
  saveMediaToQueue: vi.fn(async () => {}), addToOutbox: vi.fn(async () => {}),
  getMediaByClientParent: vi.fn(async () => []), removeMediaFromQueue: vi.fn(),
}))
vi.mock('@/components/report/use-media-urls', () => ({ useMediaUrls: () => ({ uploaded: '/photo.png' }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:queued')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function picker(offline = false, parentType: 'observation' | 'sighting' | 'incident' = 'observation') {
  const { container } = render(<MediaUploader parentType={parentType} parentId="parent-1" existingMedia={[]} offline={offline} label="Photos" />)
  return container.querySelector('input[type=file]')!
}
it.each([
  [false, 'video/webm'], [true, 'video/webm'],
  [false, 'video/mp4'], [true, 'video/mp4'],
  [false, 'video/quicktime'], [true, 'video/quicktime'],
  [false, 'image/heic'], [true, 'image/heic'],
] as const)('rejects unsupported files without uploading or queuing (offline=%s, type=%s)', async (offline, type) => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Unsupported format' })))
  fireEvent.change(picker(offline), { target: { files: [new File(['data'], 'test', { type })] } })
  await screen.findByText(/unsupported.*format/i)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(saveMediaToQueue).not.toHaveBeenCalled()
  expect(addToOutbox).not.toHaveBeenCalled()
  expect(screen.getByText('0/10')).toBeInTheDocument()
})
it.each([200, 403, 422])('shows a server rejection without queuing it (HTTP %s)', async status => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Upload rejected by server' }), { status }))
  fireEvent.change(picker(), { target: { files: [new File(['photo'], 'test.png', { type: 'image/png' })] } })
  await screen.findByText('Upload rejected by server')
  expect(saveMediaToQueue).not.toHaveBeenCalled()
  expect(screen.getByText('0/10')).toBeInTheDocument()
})
it('still queues supported files on a connectivity failure', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
  fireEvent.change(picker(), { target: { files: [new File(['photo'], 'test.png', { type: 'image/png' })] } })
  await waitFor(() => expect(saveMediaToQueue).toHaveBeenCalled())
  await screen.findByText('1/10')
  expect(addToOutbox).toHaveBeenCalled()
})
it.each(['image/jpeg', 'image/png', 'image/webp'])('uploads supported %s without queuing', async type => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, media: { id: 'uploaded', file_path: 'path', file_name: 'test', media_type: type.startsWith('video') ? 'VIDEO' : 'PHOTO' } })))
  fireEvent.change(picker(), { target: { files: [new File(['data'], 'test', { type })] } })
  await screen.findByText('1/10')
  expect(saveMediaToQueue).not.toHaveBeenCalled()
})
it('keeps incident connectivity failures visible without offline fallback', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
  fireEvent.change(picker(false, 'incident'), { target: { files: [new File(['photo'], 'test.png', { type: 'image/png' })] } })
  await screen.findByText(/Failed to upload incident media/)
  expect(saveMediaToQueue).not.toHaveBeenCalled()
})

it('shares capacity across sightings, reserves pending files, and frees a place after deletion', async () => {
  // The report form supplies one budget to all its uploaders.
  const { ReportMediaBudgetProvider } = await import('@/components/report/report-media-budget')
  const uploaded = { id: 'uploaded', file_path: 'path', file_name: 'one.png', media_type: 'PHOTO' }
  let finish!: (response: Response) => void
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { container } = render(
    <ReportMediaBudgetProvider maxFiles={2} parents={[
      { key: 'a', clientParentId: 'a', count: 1 }, { key: 'b', clientParentId: 'b', count: 0 },
    ]}>
      <MediaUploader parentType="sighting" parentId="a" clientParentId="a" existingMedia={[{ ...uploaded, id: 'existing' }]} label="A" />
      <MediaUploader parentType="sighting" parentId="b" clientParentId="b" existingMedia={[]} label="B" />
    </ReportMediaBudgetProvider>
  )
  await screen.findAllByText('1/2 in report')
  const [a, b] = Array.from(container.querySelectorAll('input[type=file]'))
  fireEvent.change(b, { target: { files: [new File(['photo'], 'two.png', { type: 'image/png' })] } })
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  // A second picker cannot claim the place reserved by B's in-flight upload.
  fireEvent.change(a, { target: { files: [new File(['photo'], 'three.png', { type: 'image/png' })] } })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  finish(new Response(JSON.stringify({ success: true, media: uploaded })))
  await screen.findAllByText('2/2 in report')
  expect(screen.queryByRole('button', { name: 'Add Photos' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Email Dr. Andie' })).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove one.png' })[0])
  await screen.findAllByText('1/2 in report')
  expect(screen.getAllByRole('button', { name: 'Add Photos' })).toHaveLength(2)
})

it('offers only supported photos and an email link for videos and extra photos', async () => {
  const input = picker()
  expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
  expect(screen.getByRole('button', { name: 'Add Photos' })).toBeInTheDocument()
  expect(screen.getByText(/For videos and additional photos beyond the report limit, email Dr\. Andie directly at/)).toHaveTextContent('primatewatching@gmail.com')
  expect(screen.getByRole('link', { name: 'Email Dr. Andie' })).toHaveAttribute('href', 'mailto:primatewatching@gmail.com')
  await waitFor(() => expect(screen.getByText('0/10')).toBeInTheDocument())
})

it('queues files under the stable client parent so reload counts them after ID assignment', async () => {
  const { container } = render(<MediaUploader parentType="sighting" parentId="server-id" clientParentId="client-id" existingMedia={[]} offline label="Photos" />)
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['photo'], 'test.png', { type: 'image/png' })] } })
  await waitFor(() => expect(saveMediaToQueue).toHaveBeenCalledWith(expect.objectContaining({ clientParentId: 'client-id', resolvedParentId: 'server-id' })))
})
