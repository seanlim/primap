import { getOutboxItems, removeFromOutbox, incrementRetry } from './db'
import { createClient } from '@/lib/supabase/client'

const MAX_RETRIES = 5

export async function processOutbox(): Promise<number> {
  const items = await getOutboxItems()
  if (items.length === 0) return 0

  const supabase = createClient()
  let processed = 0

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      // Too many retries, skip
      continue
    }

    try {
      switch (item.action) {
        case 'UPSERT_DRAFT': {
          const { walkId, observationId, ...data } = item.payload as {
            walkId: string
            observationId?: string
            [key: string]: unknown
          }

          if (observationId) {
            await supabase
              .from('observations')
              .update(data)
              .eq('id', observationId)
          } else {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')
            await supabase
              .from('observations')
              .upsert({
                slot_id: walkId,
                user_id: user.id,
                client_draft_id: item.clientDraftId,
                ...data,
              }, { onConflict: 'slot_id,user_id' })
          }
          break
        }

        case 'UPLOAD_MEDIA': {
          // Media upload is handled by the form directly
          break
        }

        case 'FINALIZE_SUBMIT': {
          const { observationId } = item.payload as { observationId: string }
          await supabase
            .from('observations')
            .update({
              status: 'SUBMITTED',
              submitted_at: new Date().toISOString(),
            })
            .eq('id', observationId)
          break
        }
      }

      await removeFromOutbox(item.id!)
      processed++
    } catch {
      await incrementRetry(item.id!)
    }
  }

  return processed
}
