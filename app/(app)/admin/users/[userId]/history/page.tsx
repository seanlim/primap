import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils/format-date'
import type { Json } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

type AuditLogRow = {
  id: string
  event_type: string
  reason: string | null
  occurred_at: string
  metadata: Json | null
}

type AuditMetadata = {
  location_name?: string
  walk_date?: string
  start_time?: string
  late_cancel_hours?: number
}

const EVENT_DISPLAY: Record<string, {
  label: string
  accent: string
  iconBg: string
  iconColor: string
}> = {
  LATE_WALK_CANCELLATION: {
    label: 'Late Walk Cancellation',
    accent: '#dc2626',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
  },
}

function asAuditMetadata(metadata: Json | null): AuditMetadata {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return {}

  return {
    location_name: typeof metadata.location_name === 'string' ? metadata.location_name : undefined,
    walk_date: typeof metadata.walk_date === 'string' ? metadata.walk_date : undefined,
    start_time: typeof metadata.start_time === 'string' ? metadata.start_time : undefined,
    late_cancel_hours: typeof metadata.late_cancel_hours === 'number' ? metadata.late_cancel_hours : undefined,
  }
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default async function AdminUserHistoryPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: auditLogs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', userId)
      .single(),
    supabase
      .from('user_audit_logs')
      .select('id, event_type, reason, occurred_at, metadata')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false }),
  ])

  if (!profile) notFound()

  const logs = (auditLogs || []) as AuditLogRow[]
  const userLabel = profile.full_name || profile.email

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="text-gray-400 hover:text-gray-600"
          aria-label="Back to users"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">User History</h1>
          <p className="truncate text-sm text-gray-500">{userLabel}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No history yet"
          description="No audit history has been recorded for this user."
        />
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const display = EVENT_DISPLAY[log.event_type] ?? {
              label: log.event_type.replaceAll('_', ' '),
              accent: '#6b7280',
              iconBg: 'bg-gray-50',
              iconColor: 'text-gray-600',
            }
            const metadata = asAuditMetadata(log.metadata)

            return (
              <article
                key={log.id}
                className="overflow-hidden rounded-xl border-l-4 bg-white shadow-sm"
                style={{ borderLeftColor: display.accent }}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${display.iconBg}`}>
                    <AlertTriangle className={`h-5 w-5 ${display.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-gray-900">{display.label}</h2>
                      <time className="text-xs text-gray-400" dateTime={log.occurred_at}>
                        {formatEventTime(log.occurred_at)}
                      </time>
                    </div>
                    {log.reason && (
                      <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                        {log.reason}
                      </p>
                    )}
                    <dl className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-3">
                      {metadata.location_name && (
                        <div>
                          <dt className="font-medium text-gray-400">Walk</dt>
                          <dd className="mt-0.5 text-gray-700">{metadata.location_name}</dd>
                        </div>
                      )}
                      {metadata.walk_date && (
                        <div>
                          <dt className="font-medium text-gray-400">Date</dt>
                          <dd className="mt-0.5 text-gray-700">
                            {formatDate(metadata.walk_date, 'compact')}
                            {metadata.start_time ? ` at ${metadata.start_time.slice(0, 5)}` : ''}
                          </dd>
                        </div>
                      )}
                      {metadata.late_cancel_hours !== undefined && (
                        <div>
                          <dt className="font-medium text-gray-400">Late Window</dt>
                          <dd className="mt-0.5 text-gray-700">{metadata.late_cancel_hours} hours</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
