'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { formatDate, toLocalDateString } from '@/lib/utils/format-date'
import { saveDraft, submitObservation, getMediaBySightingIds, getObservationMeta, getObservationFull } from '@/lib/actions/observation-actions'
import { LocationPicker } from '@/components/map/location-picker'
import { MediaUploader, type MediaItem } from '@/components/report/media-uploader'
import { StepIndicator } from '@/components/report/step-indicator'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { getDraft, putDraft, deleteDraft, clearSyncStateForWalk, getMediaByClientParent, updateMediaResolvedParentId, getOutboxItems } from '@/lib/offline/db'
import { processOutbox } from '@/lib/offline/sync-engine'
import { type SightingForm } from '@/lib/types/observation'

interface Props {
  slot: {
    id: string
    locationName: string
    walkDate: string
    startTime: string
    endTime: string
    roundName: string
  }
  existingObservation: {
    id: string
    walkCompletion: 'COMPLETED' | 'PARTIAL' | 'ABORTED'
    outcome: 'SIGHTED' | 'NOT_SIGHTED'
    notes: string | null
    lat: number | null
    lng: number | null
    serverUpdatedAt: string
    sightings: {
      id: string
      species: 'RBL' | 'LTM' | 'DUSKY'
      count: string
      observedAt: string | null
      lat: number
      lng: number
      notes: string | null
      media: MediaItem[]
    }[]
    media: MediaItem[]
  } | null
}

const WALK_COMPLETION_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'ABORTED', label: 'Aborted' },
] as const;

const SPECIES_OPTIONS = [
  { value: 'RBL', label: "Raffles' Banded Langur" },
  { value: 'LTM', label: 'Long-tailed Macaque' },
  { value: 'DUSKY', label: 'Dusky Langur' },
]

export function ObservationFormClient({ slot, existingObservation }: Props) {
  const [walkCompletion, setWalkCompletion] = useState(existingObservation?.walkCompletion ?? 'PARTIAL')
  const [notes, setNotes] = useState(existingObservation?.notes ?? '')
  const [lat, setLat] = useState<number | null>(existingObservation?.lat ?? null)
  const [lng, setLng] = useState<number | null>(existingObservation?.lng ?? null)
  const [observationId, setObservationId] = useState<string | undefined>(existingObservation?.id)
  const [clientDraftId, setClientDraftId] = useState(() => existingObservation?.id || crypto.randomUUID())
  const [sightings, setSightings] = useState<SightingForm[]>(
    existingObservation?.sightings.map(s => ({
      id: s.id,
      clientTempId: s.id,
      species: s.species,
      count: s.count,
      observedAt: s.observedAt || '',
      lat: s.lat,
      lng: s.lng,
      notes: s.notes || '',
      media: s.media || [],
    })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [activeStep, setActiveStep] = useState('walk-completion')
  const [isOnline, setIsOnline] = useState(true)
  const [mediaSyncKey, setMediaSyncKey] = useState(0)
  const [conflictState, setConflictState] = useState<{
    serverUpdatedAt: string
    localLastModified: number
  } | null>(null)
  const syncingRef = useRef(false)
  const wasOfflineRef = useRef(false)
  const router = useRouter()

  // Step indicator setup
  const hasSightingsForSteps = sightings.some(s => s.species)
  const steps = useMemo(() => {
    const base = [
      { id: 'walk-completion', label: 'Completion' },
      { id: 'sightings', label: 'Sightings' },
      { id: 'notes', label: 'Notes' },
    ]
    if (!hasSightingsForSteps) {
      base.push({ id: 'location', label: 'Location' })
      base.push({ id: 'photos', label: 'Photos' })
    }
    return base
  }, [hasSightingsForSteps])

  // IntersectionObserver to track active step
  useEffect(() => {
    const stepIds = steps.map(s => s.id)
    const elements = stepIds.map(id => document.getElementById(`step-${id}`)).filter(Boolean) as HTMLElement[]
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)
          const id = visible[0].target.id.replace('step-', '')
          setActiveStep(id)
        }
      },
      { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' }
    )

    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [steps])

  const scrollToStep = (stepId: string) => {
    document.getElementById(`step-${stepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Ref that always holds current form state
  const formStateRef = useRef({ walkCompletion, notes, lat, lng, observationId, clientDraftId, sightings })
  formStateRef.current = { walkCompletion, notes, lat, lng, observationId, clientDraftId, sightings }

  // --- LOCAL-FIRST INITIALIZATION ---
  useEffect(() => {
    async function initializeFromLocalFirst() {
      const draft = await getDraft(slot.id)

      if (draft) {
        // IndexedDB has data — use it as source of truth
        const data = draft.data
        setWalkCompletion(data.walkCompletion)
        setNotes(data.notes ?? '')
        setLat(data.lat ?? null)
        setLng(data.lng ?? null)
        setObservationId(data.observationId)
        if (data.observationId) setClientDraftId(data.observationId)
        // Merge media from server props (media can't be stored in IndexedDB)
        setSightings((data.sightings ?? []).map(ds => {
          if (ds.id && existingObservation?.sightings) {
            const ss = existingObservation.sightings.find(s => s.id === ds.id)
            if (ss) return { ...ds, media: ss.media || [] }
          }
          return { ...ds, media: ds.media ?? [] }
        }))
      } else if (existingObservation) {
        // No local draft, server has data — seed IndexedDB from server
        await putDraft(slot.id, {
          observationId: existingObservation.id,
          clientDraftId: existingObservation.id,
          walkCompletion: existingObservation.walkCompletion,
          outcome: existingObservation.outcome,
          notes: existingObservation.notes ?? undefined,
          lat: existingObservation.lat ?? undefined,
          lng: existingObservation.lng ?? undefined,
          sightings: existingObservation.sightings.map(s => ({
            id: s.id,
            clientTempId: s.id,
            species: s.species,
            count: s.count,
            observedAt: s.observedAt || '',
            lat: s.lat,
            lng: s.lng,
            notes: s.notes || '',
            media: s.media || [],
          })),
        }, existingObservation.serverUpdatedAt)
        // State already initialized from props
      }
      // If neither: empty defaults (new observation or offline first visit)
    }
    initializeFromLocalFirst()
  }, [slot.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- ONLINE/OFFLINE DETECTION + RECONNECT ---
  const pushLocalToServer = async () => {
    const draft = await getDraft(slot.id)
    if (!draft) return

    const draftSightings = (draft.data.sightings ?? []).filter(s => s.species)
    const hasSightings = draftSightings.length > 0
    const saveResult = await saveDraft({
      walkId: slot.id,
      observationId: draft.data.observationId,
      walkCompletion: draft.data.walkCompletion,
      outcome: draft.data.outcome ?? (hasSightings ? 'SIGHTED' : 'NOT_SIGHTED'),
      notes: draft.data.notes,
      lat: draft.data.lat,
      lng: draft.data.lng,
      sightings: draftSightings.map(s => ({
        id: s.id,
        species: s.species as 'RBL' | 'LTM' | 'DUSKY',
        count: s.count || '1',
        observed_at: s.observedAt || undefined,
        lat: s.lat || 0,
        lng: s.lng || 0,
        notes: s.notes || undefined,
      })),
      userAgent: navigator.userAgent,
    })

    if (saveResult.error) {
      setError('Failed to sync: ' + saveResult.error)
      return
    }

    // Map sighting IDs → media-queue
    const freshSightingIds = saveResult.sightingIds || []
    for (let i = 0; i < draftSightings.length && i < freshSightingIds.length; i++) {
      const tempId = draftSightings[i].clientTempId
      const serverId = freshSightingIds[i]
      const queued = await getMediaByClientParent(tempId)
      for (const mq of queued) {
        await updateMediaResolvedParentId(mq.id, serverId)
      }
    }

    // Remap observation-level media (NOT_SIGHTED case)
    const newObservationId = saveResult.observationId || draft.data.observationId
    if (newObservationId && draft.data.clientDraftId && draft.data.clientDraftId !== newObservationId) {
      const obsMedia = await getMediaByClientParent(draft.data.clientDraftId)
      for (const mq of obsMedia) {
        await updateMediaResolvedParentId(mq.id, newObservationId)
      }
    }

    // Upload queued media
    await processOutbox()

    // Clean up outbox + media-queue for this walk (NOT the draft)
    await clearSyncStateForWalk(slot.id)

    // Update draft with server IDs + serverUpdatedAt
    const updatedSightings = draftSightings.map((s, i) => ({
      ...s,
      id: i < freshSightingIds.length ? freshSightingIds[i] : s.id,
    }))
    const newObsId = saveResult.observationId || draft.data.observationId
    await putDraft(slot.id, {
      ...draft.data,
      observationId: newObsId,
      clientDraftId: newObsId || draft.data.clientDraftId,
      sightings: updatedSightings,
    }, saveResult.serverUpdatedAt ?? null)

    // Update React state
    if (saveResult.observationId) setObservationId(saveResult.observationId)
    if (freshSightingIds.length > 0) {
      // Fetch media via server action
      const mediaItems = await getMediaBySightingIds(freshSightingIds)
      const mediaBySighting = new Map<string, MediaItem[]>()
      for (const m of mediaItems) {
        const sid = m.sighting_id as string
        if (!mediaBySighting.has(sid)) mediaBySighting.set(sid, [])
        mediaBySighting.get(sid)!.push(m as MediaItem)
      }
      setSightings(prev => {
        const validIndexes: number[] = []
        prev.forEach((s, i) => { if (s.species) validIndexes.push(i) })
        return prev.map((s, i) => {
          const validIdx = validIndexes.indexOf(i)
          if (validIdx >= 0 && validIdx < freshSightingIds.length) {
            const serverId = freshSightingIds[validIdx]
            return { ...s, id: serverId, media: mediaBySighting.get(serverId) || s.media }
          }
          return s
        })
      })
    }
    setMediaSyncKey(k => k + 1)
  }

  const syncOnReconnectRef = useRef<() => Promise<void>>(async () => {})
  const syncOnReconnect = async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    try {
      // Write current form state to IndexedDB
      const fs = formStateRef.current
      const filteredSightings = fs.sightings.filter(s => s.species)
      const hasSightings = filteredSightings.length > 0
      const existingDraft = await getDraft(slot.id)

      await putDraft(slot.id, {
        observationId: fs.observationId,
        clientDraftId: fs.clientDraftId,
        walkCompletion: fs.walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED',
        outcome: hasSightings ? 'SIGHTED' : 'NOT_SIGHTED',
        notes: fs.notes || undefined,
        lat: fs.lat ?? undefined,
        lng: fs.lng ?? undefined,
        sightings: filteredSightings,
      }, existingDraft?.serverUpdatedAt ?? null)

      // Check for conflicts
      const serverMeta = await getObservationMeta(slot.id)
      const freshDraft = await getDraft(slot.id)

      if (!freshDraft && !serverMeta) {
        // Nothing anywhere — nothing to sync
        syncingRef.current = false
        return
      }

      if (serverMeta && freshDraft?.serverUpdatedAt) {
        const serverTime = new Date(serverMeta.updatedAt).getTime()
        const localKnownServerTime = new Date(freshDraft.serverUpdatedAt).getTime()

        if (serverTime > localKnownServerTime) {
          // Server changed since our last sync
          if (serverMeta.lastUserAgent && serverMeta.lastUserAgent !== navigator.userAgent) {
            // Different device — show conflict dialog
            setConflictState({
              serverUpdatedAt: serverMeta.updatedAt,
              localLastModified: freshDraft.lastModified,
            })
            syncingRef.current = false
            return
          }
          // Same device — push local (user's latest intent)
        }
      }

      // No conflict — push local to server
      await pushLocalToServer()
      setSavedMessage('Synced')
      setTimeout(() => setSavedMessage(''), 3000)
    } catch (err) {
      console.error('[offline-sync] sync on reconnect failed:', err)
      setError('Failed to sync: ' + String(err))
    } finally {
      syncingRef.current = false
    }
  }
  syncOnReconnectRef.current = syncOnReconnect

  // Conflict resolution handlers
  const handleKeepLocal = async () => {
    setConflictState(null)
    syncingRef.current = true
    try {
      await pushLocalToServer()
      setSavedMessage('Local changes synced')
      setTimeout(() => setSavedMessage(''), 3000)
    } catch (err) {
      setError('Failed to sync: ' + String(err))
    } finally {
      syncingRef.current = false
    }
  }

  const handleUseServer = async () => {
    setConflictState(null)
    try {
      const serverData = await getObservationFull(slot.id)
      if (!serverData) {
        setError('Failed to fetch server data')
        return
      }
      // Overwrite IndexedDB + form state with server data
      const serverSightings: SightingForm[] = serverData.sightings.map(s => ({
        id: s.id,
        clientTempId: s.id,
        species: s.species as SightingForm['species'],
        count: s.count,
        observedAt: s.observedAt || '',
        lat: s.lat,
        lng: s.lng,
        notes: s.notes || '',
        media: s.media || [],
      }))
      await putDraft(slot.id, {
        observationId: serverData.id,
        clientDraftId: serverData.id,
        walkCompletion: serverData.walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED',
        outcome: serverData.outcome as 'SIGHTED' | 'NOT_SIGHTED',
        notes: serverData.notes ?? undefined,
        lat: serverData.lat ?? undefined,
        lng: serverData.lng ?? undefined,
        sightings: serverSightings,
      }, serverData.serverUpdatedAt)

      setWalkCompletion(serverData.walkCompletion)
      setNotes(serverData.notes ?? '')
      setLat(serverData.lat ?? null)
      setLng(serverData.lng ?? null)
      setObservationId(serverData.id)
      setSightings(serverSightings)

      // Clean up any queued offline items
      await clearSyncStateForWalk(slot.id)
      setMediaSyncKey(k => k + 1)
      setSavedMessage('Loaded server version')
      setTimeout(() => setSavedMessage(''), 3000)
    } catch (err) {
      setError('Failed to load server version: ' + String(err))
    }
  }

  useEffect(() => {
    setIsOnline(navigator.onLine)
    wasOfflineRef.current = !navigator.onLine
    const goOnline = () => {
      setIsOnline(true)
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false
        syncOnReconnectRef.current()
      }
    }
    const goOffline = () => {
      setIsOnline(false)
      wasOfflineRef.current = true
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Flush to IndexedDB when page goes to background (closes debounce gap on mobile)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        const fs = formStateRef.current
        const filtered = fs.sightings.filter(s => s.species)
        const has = filtered.length > 0
        getDraft(slot.id).then(existing => {
          putDraft(slot.id, {
            observationId: fs.observationId,
            clientDraftId: fs.clientDraftId,
            walkCompletion: fs.walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED',
            outcome: has ? 'SIGHTED' : 'NOT_SIGHTED',
            notes: fs.notes || undefined,
            lat: fs.lat ?? undefined,
            lng: fs.lng ?? undefined,
            sightings: filtered,
          }, existing?.serverUpdatedAt ?? null)
        })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [slot.id])

  // --- SIGHTING MANAGEMENT ---
  const addSighting = () => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${toLocalDateString(now)}T${hh}:${min}`

    setSightings(prev => [...prev, {
      clientTempId: crypto.randomUUID(),
      species: '',
      count: '1',
      observedAt: currentTime,
      lat: null,
      lng: null,
      notes: '',
      media: [],
    }])
  }

  const removeSighting = (index: number) => {
    setSightings(prev => prev.filter((_, i) => i !== index))
  }

  const [autoSaveCounter, setAutoSaveCounter] = useState(0)
  const [autoSavingIndexes, setAutoSavingIndexes] = useState<Set<number>>(new Set())
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerDebouncedSave = () => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
    debouncedSaveRef.current = setTimeout(() => {
      setAutoSaveCounter(c => c + 1)
    }, 1500)
  }

  const updateSighting = (index: number, field: keyof SightingForm, value: string | number | null) => {
    setSightings(prev => {
      const updated = prev.map((s, i) => i === index ? { ...s, [field]: value } : s)
      if (field === 'species' && value && !prev[index].id) {
        setAutoSavingIndexes(prev => new Set(prev).add(index))
        setAutoSaveCounter(c => c + 1)
      } else if (field !== 'media') {
        triggerDebouncedSave()
      }
      return updated
    })
  }

  const buildSightingsPayload = (fromSightings?: SightingForm[]) => {
    return (fromSightings ?? sightings).filter(s => s.species).map(s => ({
      id: s.id,
      species: s.species as 'RBL' | 'LTM' | 'DUSKY',
      count: s.count || '1',
      observed_at: s.observedAt || undefined,
      lat: s.lat || 0,
      lng: s.lng || 0,
      notes: s.notes || undefined,
    }))
  }

  // --- SAVE DRAFT (LOCAL-FIRST) ---
  const handleSaveDraft = async (silent = false) => {
    if (syncingRef.current) return // Don't save during sync
    setSaving(true)
    if (!silent) { setError(''); setSavedMessage('') }

    const validSightings = buildSightingsPayload()
    const hasSightings = validSightings.length > 0
    const formData = {
      observationId,
      clientDraftId,
      walkCompletion: walkCompletion as 'COMPLETED' | 'PARTIAL' | 'ABORTED',
      outcome: (hasSightings ? 'SIGHTED' : 'NOT_SIGHTED') as 'SIGHTED' | 'NOT_SIGHTED',
      notes: notes || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      sightings: sightings.filter(s => s.species),
    }

    // 1. Always write to IndexedDB first (local-first)
    const existingDraft = await getDraft(slot.id)
    await putDraft(slot.id, formData, existingDraft?.serverUpdatedAt ?? null)

    // 2. If offline, we're done
    if (!navigator.onLine) {
      if (!silent) {
        setSavedMessage('Draft saved offline')
        setTimeout(() => setSavedMessage(''), 3000)
      }
      setSaving(false)
      return
    }

    // 3. Online: push to server
    const result = await saveDraft({
      walkId: slot.id,
      observationId,
      walkCompletion: walkCompletion,
      outcome: hasSightings ? 'SIGHTED' : 'NOT_SIGHTED',
      notes: notes || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      sightings: validSightings,
      userAgent: navigator.userAgent,
    })

    if (result.error) {
      if (!silent) setError(result.error)
    } else {
      // 4. Update draft with server IDs + serverUpdatedAt (NEVER delete draft)
      const newObsId = result.observationId || observationId
      const newSightingIds = result.sightingIds || []

      if (result.observationId) {
        setObservationId(result.observationId)
        setClientDraftId(result.observationId)
      }
      if (newSightingIds.length > 0) {
        setSightings(prev => {
          const validIndexes: number[] = []
          prev.forEach((s, i) => { if (s.species) validIndexes.push(i) })
          return prev.map((s, i) => {
            const validIdx = validIndexes.indexOf(i)
            if (validIdx >= 0 && validIdx < newSightingIds.length) {
              return { ...s, id: newSightingIds[validIdx] }
            }
            return s
          })
        })
      }

      // Update IndexedDB with server-assigned IDs
      const updatedSightings = sightings.filter(s => s.species).map((s, i) => ({
        ...s,
        id: i < newSightingIds.length ? newSightingIds[i] : s.id,
      }))
      await putDraft(slot.id, {
        ...formData,
        observationId: newObsId,
        sightings: updatedSightings,
      }, result.serverUpdatedAt ?? null)

      if (!silent) {
        setSavedMessage('Draft saved')
        setTimeout(() => setSavedMessage(''), 2000)
      }
    }
    setSaving(false)
  }

  // Auto-save
  const autoSaveRef = useRef(0)
  useEffect(() => {
    if (autoSaveCounter > 0 && autoSaveCounter !== autoSaveRef.current) {
      autoSaveRef.current = autoSaveCounter
      handleSaveDraft(true).then(() => setAutoSavingIndexes(new Set()))
    }
  }, [autoSaveCounter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current) }
  }, [])

  // --- SUBMIT ---
  const handleSubmit = () => {
    setShowSubmitDialog(true)
  }

  const confirmSubmit = async () => {
    setShowSubmitDialog(false)
    setSaving(true)
    setSubmitting(true)
    setError('')

    const validSightings = buildSightingsPayload()
    const hasSightingsNow = validSightings.length > 0
    const outcome = hasSightingsNow ? 'SIGHTED' : 'NOT_SIGHTED'

    const saveResult = await saveDraft({
      walkId: slot.id,
      observationId,
      walkCompletion: walkCompletion,
      outcome,
      notes: notes || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      sightings: validSightings,
      userAgent: navigator.userAgent,
    })

    if (saveResult.error) {
      setError(saveResult.error)
      setSaving(false)
      setSubmitting(false)
      return
    }

    const obsId = saveResult.observationId || observationId
    if (!obsId) {
      setError('Failed to save observation')
      setSaving(false)
      setSubmitting(false)
      return
    }

    const submitResult = await submitObservation(obsId, slot.id)
    if (submitResult.error) {
      setError(submitResult.error)
    } else {
      // Only time we delete the draft — observation is finalized
      await deleteDraft(slot.id)
      await clearSyncStateForWalk(slot.id)
      router.push(`/report/${slot.id}`)
    }
    setSaving(false)
    setSubmitting(false)
  }

  const hasSightings = sightings.some(s => s.species)

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Reports', href: '/report' },
        { label: slot.locationName, href: `/report/${slot.id}` },
        { label: 'Edit' },
      ]} />

      <div>
        <h1 className="text-xl font-bold text-gray-900">Edit Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          {slot.locationName} &middot; {formatDate(slot.walkDate, 'compact')}
        </p>
      </div>

      <StepIndicator steps={steps} activeStepId={activeStep} onStepClick={scrollToStep} />

      {/* Conflict resolution dialog */}
      {conflictState && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm text-amber-800 font-medium">
            This report was edited on another device while you were offline.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleKeepLocal}
              className="flex-1 py-2 px-3 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700"
            >
              Keep my local changes
            </button>
            <button
              onClick={handleUseServer}
              className="flex-1 py-2 px-3 border border-amber-300 text-amber-800 rounded-xl text-sm font-medium hover:bg-amber-100"
            >
              Use server version
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Walk Completion */}
      <div id="step-walk-completion" className="bg-white rounded-2xl p-5 shadow-sm space-y-3 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900">1. Walk Completion</h2>
        <div className="grid grid-cols-3 gap-2">
          {WALK_COMPLETION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setWalkCompletion(opt.value); triggerDebouncedSave() }}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                walkCompletion === opt.value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Sightings */}
      <div id="step-sightings" className="bg-white rounded-2xl p-5 shadow-sm space-y-4 scroll-mt-20">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">2. Sightings</h2>
          <button
            type="button"
            onClick={addSighting}
            className="flex items-center gap-1 text-sm text-green-600 font-medium hover:text-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Sighting
          </button>
        </div>

        {sightings.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No sightings yet
          </p>
        )}

        {sightings.map((sighting, index) => (
          <div key={sighting.clientTempId} className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Sighting #{index + 1}</span>
              <button
                type="button"
                onClick={() => removeSighting(index)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Species *</label>
              <select
                value={sighting.species}
                onChange={(e) => updateSighting(index, 'species', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select species...</option>
                {SPECIES_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {sighting.species && autoSavingIndexes.has(index) && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}

            {sighting.species && !autoSavingIndexes.has(index) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Count *</label>
                    <input
                      type="text"
                      value={sighting.count}
                      onChange={(e) => updateSighting(index, 'count', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g. 3, 5-8, Unknown"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                    <input
                      type="datetime-local"
                      value={sighting.observedAt}
                      onChange={(e) => updateSighting(index, 'observedAt', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">GPS Location *</label>
                  <LocationPicker
                    lat={sighting.lat}
                    lng={sighting.lng}
                    onLocationChange={(newLat, newLng) => {
                      updateSighting(index, 'lat', newLat)
                      updateSighting(index, 'lng', newLng)
                    }}
                  />
                  {sighting.lat && sighting.lng && (
                    <p className="text-xs text-gray-400 mt-1">
                      {sighting.lat.toFixed(5)}, {sighting.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <textarea
                    value={sighting.notes}
                    onChange={(e) => updateSighting(index, 'notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Additional notes for this sighting..."
                  />
                </div>

                {/* Media for this sighting */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Photos/Videos</label>
                  <MediaUploader
                    parentType="sighting"
                    parentId={sighting.id ?? null}
                    clientParentId={sighting.clientTempId}
                    existingMedia={sighting.media}
                    onExifGps={(exifLat, exifLng) => {
                      if (!sighting.lat && !sighting.lng) {
                        updateSighting(index, 'lat', exifLat)
                        updateSighting(index, 'lng', exifLng)
                      }
                    }}
                    onExifDatetime={(datetime) => {
                      if (!sighting.observedAt) {
                        updateSighting(index, 'observedAt', datetime)
                      }
                    }}
                    offline={!isOnline}
                    syncKey={mediaSyncKey}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Step 3: Additional Notes */}
      <div id="step-notes" className="bg-white rounded-2xl p-5 shadow-sm space-y-3 scroll-mt-20">
        <h2 className="text-sm font-semibold text-gray-900">3. Additional Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); triggerDebouncedSave() }}
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Any additional observations or notes..."
        />
      </div>

      {/* Step 4: Walk Location (only when no sightings for NOT_SIGHTED) */}
      {!hasSightings && (
        <div id="step-location" className="bg-white rounded-2xl p-5 shadow-sm space-y-3 scroll-mt-20">
          <h2 className="text-sm font-semibold text-gray-900">4. Walk Location</h2>
          <p className="text-xs text-gray-400">Required when submitting with no sightings</p>
          <LocationPicker
            lat={lat}
            lng={lng}
            onLocationChange={(newLat, newLng) => {
              setLat(newLat)
              setLng(newLng)
              triggerDebouncedSave()
            }}
          />
          {lat && lng && (
            <p className="text-xs text-gray-400 mt-1">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}
        </div>
      )}

      {/* Step 5: Observation-level media (only when no sightings for NOT_SIGHTED) */}
      {!hasSightings && (
        <div id="step-photos" className="bg-white rounded-2xl p-5 shadow-sm space-y-3 scroll-mt-20">
          <h2 className="text-sm font-semibold text-gray-900">5. Photos/Videos</h2>
          <MediaUploader
            parentType="observation"
            parentId={observationId ?? null}
            clientParentId={clientDraftId}
            existingMedia={existingObservation?.media || []}
            onExifGps={(exifLat, exifLng) => {
              if (!lat && !lng) {
                setLat(exifLat)
                setLng(exifLng)
                triggerDebouncedSave()
              }
            }}
            offline={!isOnline}
            syncKey={mediaSyncKey}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
      )}

      {savedMessage && (
        <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{savedMessage}</p>
      )}

      {!isOnline && (
        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
          You are offline. Changes will be saved locally and synced when you reconnect.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => handleSaveDraft()}
          disabled={saving}
          className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
        >
          {saving && !submitting ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isOnline || saving || !walkCompletion}
          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>

      <ConfirmationDialog
        open={showSubmitDialog}
        title="Submit Report"
        message={
          sightings.some(s => s.species)
            ? "Submit this report? You won't be able to edit it after submission."
            : "You haven't added any sightings. Submit? You won't be able to edit it after submission."
        }
        confirmLabel="Submit"
        onConfirm={confirmSubmit}
        onCancel={() => setShowSubmitDialog(false)}
      />
    </div>
  )
}
