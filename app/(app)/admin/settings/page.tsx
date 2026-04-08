import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'
import {
  DEFAULT_LATE_CANCEL_HOURS,
  DEFAULT_MAX_MEDIA_PER_REPORT,
  DEFAULT_REQUIRED_WALKS_PER_ROUND,
} from '@/lib/constants/settings'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .limit(1)
    .single()

  return (
    <SettingsClient
      settings={{
        requiredWalksPerRound: settings?.required_walks_per_round ?? DEFAULT_REQUIRED_WALKS_PER_ROUND,
        lateCancelHours: settings?.late_cancel_hours ?? DEFAULT_LATE_CANCEL_HOURS,
        maxMediaPerReport: settings?.max_media_per_report ?? DEFAULT_MAX_MEDIA_PER_REPORT,
      }}
    />
  )
}
