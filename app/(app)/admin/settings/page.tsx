import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'

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
        requiredWalksPerRound: settings?.required_walks_per_round || 4,
        lateCancelHours: settings?.late_cancel_hours || 48,
      }}
    />
  )
}
