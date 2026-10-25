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
it.each([false, true])('rejects WebM with visible feedback and no queued preview (offline=%s)', async offline => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Unsupported format' })))
  fireEvent.change(picker(offline), { target: { files: [new File(['video'], 'test.webm', { type: 'video/webm' })] } })
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
it.each(['image/png', 'video/mp4'])('uploads supported %s without queuing', async type => {
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
