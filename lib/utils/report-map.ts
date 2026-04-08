import { formatDate } from '@/lib/utils/format-date'

type PopupMetaSlot = {
  location_name?: string | null
  walk_date?: string | null
  start_time?: string | null
}

export function buildSlotPopupMeta(slot?: PopupMetaSlot | null, roundName?: string | null): string[] {
  return [
    slot?.location_name ?? null,
    slot?.walk_date && slot?.start_time ? `${formatDate(slot.walk_date, 'compact')} ${slot.start_time.slice(0, 5)}` : null,
    roundName ?? null,
  ].filter(Boolean) as string[]
}
