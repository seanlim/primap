'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Upload, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface ImportSummary {
  [table: string]: {
    inserted?: number
    skipped?: number
    uploaded?: number
    errors?: string[]
  }
}

interface LegacySummary {
  rows_processed: number
  observations_created: number
  sightings_created: number
  walk_slots_created: number
  slot_memberships_created: number
}

interface ValidationError {
  row: number
  column?: string
  message: string
}

export function DataClient() {
  const { showToast } = useToast()

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // Backup restore state
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Legacy import state
  const [isImportingLegacy, setIsImportingLegacy] = useState(false)
  const [legacyResult, setLegacyResult] = useState<LegacySummary | null>(null)
  const [legacyErrors, setLegacyErrors] = useState<ValidationError[]>([])
  const legacyFileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/admin/export')
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Export failed (${res.status})`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')
        ?.match(/filename="(.+)"/)?.[1]
        ?? `primap-export-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Export downloaded successfully', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    const file = importFileRef.current?.files?.[0]
    if (!file) {
      importFileRef.current?.click()
      return
    }

    setIsImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Import failed')

      setImportResult(body.summary)
      if (body.partial) {
        showToast('Backup restored with some errors', 'info')
      } else {
        showToast('Backup restored successfully', 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error')
    } finally {
      setIsImporting(false)
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  const handleLegacyImport = async () => {
    const file = legacyFileRef.current?.files?.[0]
    if (!file) {
      legacyFileRef.current?.click()
      return
    }

    setIsImportingLegacy(true)
    setLegacyResult(null)
    setLegacyErrors([])
    let hasValidationErrors = false
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/import-legacy', {
        method: 'POST',
        body: formData,
      })

      const body = await res.json()
      if (!res.ok) {
        if (body.errors) {
          setLegacyErrors(body.errors)
          hasValidationErrors = true
        }
        throw new Error(body.error ?? 'Import failed')
      }

      setLegacyResult(body.summary)
      showToast('Legacy data imported successfully', 'success')
    } catch (err) {
      if (!hasValidationErrors) {
        showToast(err instanceof Error ? err.message : 'Import failed', 'error')
      }
    } finally {
      setIsImportingLegacy(false)
      if (legacyFileRef.current) legacyFileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
      </div>

      {/* Export Section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Download className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
            <p className="text-sm text-gray-500">
              Download all data as an Excel workbook with media files
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Exports all tables (profiles, rounds, walks, observations, sightings, media, incidents, settings)
          as a .zip file containing an Excel workbook and all uploaded photos/videos.
        </p>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isExporting ? 'Exporting... This may take a while' : 'Export All Data'}
        </button>
      </div>

      {/* Backup Restore Section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Restore from Backup</h2>
            <p className="text-sm text-gray-500">
              Upload a .zip file previously exported from Primap
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Existing data will NOT be overwritten. Only new records will be added.
          Media files will be re-uploaded to storage.
        </p>
        <input
          ref={importFileRef}
          type="file"
          accept=".zip"
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
        />
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isImporting ? 'Restoring...' : 'Upload & Restore'}
        </button>

        {importResult && (
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <p className="font-medium text-gray-700 mb-2">Restore Summary</p>
            {Object.entries(importResult).map(([table, stats]) => (
              <div key={table} className="flex justify-between text-gray-600">
                <span>{table}</span>
                <span>
                  {stats.inserted ?? stats.uploaded ?? 0} added,{' '}
                  {stats.skipped ?? 0} skipped
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legacy Import Section */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Legacy Data</h2>
            <p className="text-sm text-gray-500">
              Import observation data from a legacy spreadsheet
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-400 space-y-1">
          <p>Upload an .xlsx file with the following columns:</p>
          <p className="font-mono">
            round_name, location_name, walk_date, start_time, end_time,
            observer_email, walk_completion, outcome
          </p>
          <p>
            Optional: observation_notes, observation_lat, observation_lng,
            species, count, sighting_lat, sighting_lng, observed_at, sighting_notes
          </p>
          <p className="text-amber-500">
            Rounds and observer accounts must already exist in the system.
          </p>
        </div>
        <input
          ref={legacyFileRef}
          type="file"
          accept=".xlsx"
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
        />
        <button
          onClick={handleLegacyImport}
          disabled={isImportingLegacy}
          className="w-full bg-orange-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {isImportingLegacy ? 'Validating & Importing...' : 'Validate & Import'}
        </button>

        {legacyErrors.length > 0 && (
          <div className="bg-red-50 rounded-xl p-4 text-sm space-y-1 max-h-60 overflow-y-auto">
            <p className="font-medium text-red-700 mb-2">
              Validation Errors ({legacyErrors.length})
            </p>
            {legacyErrors.map((err, i) => (
              <p key={i} className="text-red-600">
                Row {err.row}{err.column ? ` [${err.column}]` : ''}: {err.message}
              </p>
            ))}
          </div>
        )}

        {legacyResult && (
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <p className="font-medium text-gray-700 mb-2">Import Summary</p>
            <div className="flex justify-between text-gray-600">
              <span>Rows processed</span>
              <span>{legacyResult.rows_processed}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Observations created</span>
              <span>{legacyResult.observations_created}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Sightings created</span>
              <span>{legacyResult.sightings_created}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Walk slots created</span>
              <span>{legacyResult.walk_slots_created}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Slot memberships created</span>
              <span>{legacyResult.slot_memberships_created}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
