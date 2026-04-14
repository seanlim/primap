import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAllRows, downloadMediaFile, uploadMediaFile } from '@/lib/export-import/media-helpers'

function createMockClient(options: {
  selectResults?: { data: unknown[] | null; error: { message: string } | null }[]
  downloadResult?: { data: Blob | null; error: { message: string } | null }
  uploadResult?: { error: { message: string } | null }
} = {}) {
  const selectResults = options.selectResults ?? [{ data: [], error: null }]
  let callIndex = 0

  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockImplementation(() => {
          const result = selectResults[callIndex] ?? { data: [], error: null }
          callIndex++
          return Promise.resolve(result)
        }),
      }),
    }),
  })

  const mockStorage = {
    from: vi.fn().mockReturnValue({
      download: vi.fn().mockResolvedValue(
        options.downloadResult ?? { data: null, error: { message: 'Not found' } }
      ),
      upload: vi.fn().mockResolvedValue(
        options.uploadResult ?? { error: null }
      ),
    }),
  }

  return { from: mockFrom, storage: mockStorage } as unknown as Parameters<typeof fetchAllRows>[0]
}

describe('fetchAllRows', () => {
  it('fetches all rows from a table in a single page', async () => {
    const rows = [{ id: '1' }, { id: '2' }]
    const client = createMockClient({
      selectResults: [{ data: rows, error: null }],
    })

    const result = await fetchAllRows(client, 'profiles')
    expect(result).toEqual(rows)
  })

  it('fetches multiple pages when data exceeds PAGE_SIZE', async () => {
    // Simulate 1000 rows on first page (full page), then 500 on second (partial = last page)
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `p1-${i}` }))
    const page2 = Array.from({ length: 500 }, (_, i) => ({ id: `p2-${i}` }))

    const client = createMockClient({
      selectResults: [
        { data: page1, error: null },
        { data: page2, error: null },
      ],
    })

    const result = await fetchAllRows(client, 'profiles')
    expect(result).toHaveLength(1500)
    expect(result[0].id).toBe('p1-0')
    expect(result[1000].id).toBe('p2-0')
  })

  it('returns empty array for table with no data', async () => {
    const client = createMockClient({
      selectResults: [{ data: [], error: null }],
    })

    const result = await fetchAllRows(client, 'profiles')
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    const client = createMockClient({
      selectResults: [{ data: null, error: null }],
    })

    const result = await fetchAllRows(client, 'profiles')
    expect(result).toEqual([])
  })

  it('throws when DB query returns error', async () => {
    const client = createMockClient({
      selectResults: [{ data: null, error: { message: 'Connection failed' } }],
    })

    await expect(fetchAllRows(client, 'profiles')).rejects.toThrow('Failed to fetch profiles: Connection failed')
  })

  it('stops paginating when a page returns fewer rows than PAGE_SIZE', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ id: `${i}` }))

    const client = createMockClient({
      selectResults: [{ data: page1, error: null }],
    })

    const result = await fetchAllRows(client, 'profiles')
    expect(result).toHaveLength(500)
  })
})

describe('downloadMediaFile', () => {
  it('returns ArrayBuffer on successful download', async () => {
    const blob = new Blob(['file-content'], { type: 'image/jpeg' })
    const client = createMockClient({
      downloadResult: { data: blob, error: null },
    })

    const { data, error } = await downloadMediaFile(client, 'user1/obs1/photo.jpg')
    expect(error).toBeNull()
    expect(data).toBeInstanceOf(ArrayBuffer)
    expect(data!.byteLength).toBeGreaterThan(0)
  })

  it('uses the provided bucket for incident media downloads', async () => {
    const blob = new Blob(['file-content'], { type: 'image/jpeg' })
    const client = createMockClient({
      downloadResult: { data: blob, error: null },
    }) as unknown as {
      storage: { from: ReturnType<typeof vi.fn> }
    }

    await downloadMediaFile(client as never, 'user1/incidents/i1/photo.jpg', { bucket: 'incident-media' })

    expect(client.storage.from).toHaveBeenCalledWith('incident-media')
  })

  it('returns error when download fails', async () => {
    const client = createMockClient({
      downloadResult: { data: null, error: { message: 'Object not found' } },
    })

    const { data, error } = await downloadMediaFile(client, 'nonexistent.jpg')
    expect(data).toBeNull()
    expect(error).toBe('Object not found')
  })

  it('returns error when data is null without error', async () => {
    const client = createMockClient({
      downloadResult: { data: null, error: null },
    })

    const { data, error } = await downloadMediaFile(client, 'empty.jpg')
    expect(data).toBeNull()
    expect(error).toBe('No data returned')
  })

  it('handles thrown exceptions gracefully', async () => {
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockRejectedValue(new Error('Network timeout')),
        }),
      },
    } as unknown as Parameters<typeof downloadMediaFile>[0]

    const { data, error } = await downloadMediaFile(client, 'file.jpg')
    expect(data).toBeNull()
    expect(error).toBe('Network timeout')
  })
})

describe('uploadMediaFile', () => {
  it('returns success on successful upload', async () => {
    const client = createMockClient({ uploadResult: { error: null } })

    const { error, skipped } = await uploadMediaFile(
      client,
      'user1/obs1/photo.jpg',
      new Uint8Array([1, 2, 3])
    )
    expect(error).toBeNull()
    expect(skipped).toBe(false)
  })

  it('uses the provided bucket for incident media uploads', async () => {
    const client = createMockClient({ uploadResult: { error: null } }) as unknown as {
      storage: { from: ReturnType<typeof vi.fn> }
    }

    await uploadMediaFile(
      client as never,
      'user1/incidents/i1/photo.jpg',
      new Uint8Array([1, 2, 3]),
      { bucket: 'incident-media' }
    )

    expect(client.storage.from).toHaveBeenCalledWith('incident-media')
  })

  it('returns skipped=true when file already exists (Duplicate)', async () => {
    const client = createMockClient({
      uploadResult: { error: { message: 'Duplicate: file already exists' } },
    })

    const { error, skipped } = await uploadMediaFile(
      client,
      'user1/obs1/photo.jpg',
      new Uint8Array([1, 2, 3])
    )
    expect(error).toBeNull()
    expect(skipped).toBe(true)
  })

  it('returns skipped=true when file already exists (already exists)', async () => {
    const client = createMockClient({
      uploadResult: { error: { message: 'The resource already exists' } },
    })

    const { error, skipped } = await uploadMediaFile(
      client,
      'user1/obs1/photo.jpg',
      new Uint8Array([1, 2, 3])
    )
    expect(error).toBeNull()
    expect(skipped).toBe(true)
  })

  it('returns error for non-duplicate upload errors', async () => {
    const client = createMockClient({
      uploadResult: { error: { message: 'Bucket not found' } },
    })

    const { error, skipped } = await uploadMediaFile(
      client,
      'user1/obs1/photo.jpg',
      new Uint8Array([1, 2, 3])
    )
    expect(error).toBe('Bucket not found')
    expect(skipped).toBe(false)
  })

  it('handles thrown exceptions gracefully', async () => {
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockRejectedValue(new Error('Connection reset')),
        }),
      },
    } as unknown as Parameters<typeof uploadMediaFile>[0]

    const { error, skipped } = await uploadMediaFile(
      client,
      'file.jpg',
      new Uint8Array([1])
    )
    expect(error).toBe('Connection reset')
    expect(skipped).toBe(false)
  })

  it('infers content type from file extension', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({ upload: uploadMock }),
      },
    } as unknown as Parameters<typeof uploadMediaFile>[0]

    await uploadMediaFile(client, 'photo.jpg', new Uint8Array([1]))

    expect(uploadMock).toHaveBeenCalledWith(
      'photo.jpg',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/jpeg' })
    )
  })

  it('infers video content type for .mp4', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({ upload: uploadMock }),
      },
    } as unknown as Parameters<typeof uploadMediaFile>[0]

    await uploadMediaFile(client, 'video.mp4', new Uint8Array([1]))

    expect(uploadMock).toHaveBeenCalledWith(
      'video.mp4',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'video/mp4' })
    )
  })

  it('uses custom content type when provided', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({ upload: uploadMock }),
      },
    } as unknown as Parameters<typeof uploadMediaFile>[0]

    await uploadMediaFile(client, 'file.bin', new Uint8Array([1]), { contentType: 'application/pdf' })

    expect(uploadMock).toHaveBeenCalledWith(
      'file.bin',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'application/pdf' })
    )
  })

  it('uses octet-stream for unknown extensions', async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null })
    const client = {
      storage: {
        from: vi.fn().mockReturnValue({ upload: uploadMock }),
      },
    } as unknown as Parameters<typeof uploadMediaFile>[0]

    await uploadMediaFile(client, 'file.xyz', new Uint8Array([1]))

    expect(uploadMock).toHaveBeenCalledWith(
      'file.xyz',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'application/octet-stream' })
    )
  })
})
