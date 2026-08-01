with resolved_late_cancellation_logs as (
  select
    ual.id as audit_log_id,
    ws.id as resolved_slot_id,
    ws.round_id,
    ws.walk_date,
    ws.start_time,
    ws.location_name,
    ws.reminder_sent_at
  from public.user_audit_logs ual
  left join public.walk_slots ws
    on (
      ual.slot_id = ws.id
      or (
        ual.slot_id is null
        and ual.round_id = ws.round_id
        and ual.metadata ->> 'walk_date' = ws.walk_date::text
        and ual.metadata ->> 'start_time' = ws.start_time::text
        and ual.metadata ->> 'location_name' = ws.location_name
        and exists (
          select 1
          from public.slot_memberships sm
          where sm.slot_id = ws.id
            and sm.user_id = ual.user_id
            and sm.status = 'CANCELLED'
        )
      )
    )
  where ual.event_type = 'LATE_WALK_CANCELLATION'
),
invalid_late_cancellation_logs as (
  select r.audit_log_id
  from resolved_late_cancellation_logs r
  join public.user_audit_logs ual on ual.id = r.audit_log_id
  group by r.audit_log_id, ual.occurred_at
  having
    count(r.resolved_slot_id) <> 1
    or max(r.reminder_sent_at) is null
    or ual.occurred_at <= max(r.reminder_sent_at)
)
delete from public.user_audit_logs ual
using invalid_late_cancellation_logs invalid
where ual.id = invalid.audit_log_id;

with resolved_late_cancellation_logs as (
  select
    ual.id as audit_log_id,
    ws.id as resolved_slot_id,
    ws.round_id,
    ws.walk_date,
    ws.start_time,
    ws.location_name,
    ws.reminder_sent_at
  from public.user_audit_logs ual
  join public.walk_slots ws
    on (
      ual.slot_id = ws.id
      or (
        ual.slot_id is null
        and ual.round_id = ws.round_id
        and ual.metadata ->> 'walk_date' = ws.walk_date::text
        and ual.metadata ->> 'start_time' = ws.start_time::text
        and ual.metadata ->> 'location_name' = ws.location_name
        and exists (
          select 1
          from public.slot_memberships sm
          where sm.slot_id = ws.id
            and sm.user_id = ual.user_id
            and sm.status = 'CANCELLED'
        )
      )
    )
  where ual.event_type = 'LATE_WALK_CANCELLATION'
    and ws.reminder_sent_at is not null
    and ual.occurred_at > ws.reminder_sent_at
)
update public.user_audit_logs ual
set
  slot_id = resolved.resolved_slot_id,
  round_id = resolved.round_id,
  metadata = jsonb_build_object(
    'walk_date', resolved.walk_date,
    'start_time', resolved.start_time,
    'location_name', resolved.location_name,
    'reminder_sent_at', resolved.reminder_sent_at
  )
from resolved_late_cancellation_logs resolved
where ual.id = resolved.audit_log_id;

alter table public.user_audit_logs
  add constraint user_audit_logs_late_cancellation_slot_id_required
  check (event_type <> 'LATE_WALK_CANCELLATION' or slot_id is not null);
