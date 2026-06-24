alter table public.app_settings
  add column if not exists reminder_send_weekday integer not null default 3,
  add column if not exists reminder_send_time time without time zone not null default '13:00:00'::time,
  add column if not exists reminder_window_start_offset_days integer not null default 2,
  add column if not exists reminder_window_length_days integer not null default 7;

alter table public.app_settings
  drop column if exists late_cancel_hours;

alter table public.walk_slots
  add column if not exists reminder_sent_at timestamptz;

create or replace function public.cancel_slot_with_draft_cleanup(
  p_slot_id uuid,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_has_submitted boolean;
  v_draft_ids uuid[];
  v_file_paths text[];
  v_slot record;
  v_trimmed_reason text := nullif(btrim(p_cancellation_reason), '');
  v_is_late_cancellation boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select
    ws.walk_date,
    ws.start_time,
    ws.location_name,
    ws.round_id,
    ws.reminder_sent_at
  into v_slot
  from public.walk_slots ws
  where ws.id = p_slot_id;

  if not found then
    return jsonb_build_object('error', 'Walk slot not found.');
  end if;

  v_is_late_cancellation := v_slot.reminder_sent_at is not null;

  if v_is_late_cancellation and v_trimmed_reason is null then
    return jsonb_build_object('error', 'Please provide a reason for this late cancellation.');
  end if;

  if v_trimmed_reason is not null and length(v_trimmed_reason) > 1000 then
    return jsonb_build_object('error', 'Cancellation reason must be 1000 characters or fewer.');
  end if;

  select id
  into v_membership_id
  from public.slot_memberships
  where slot_id = p_slot_id
    and user_id = v_user_id
    and status = 'ACTIVE'
  limit 1
  for update;

  if v_membership_id is null then
    return jsonb_build_object('error', 'You are not actively joined to this walk.');
  end if;

  select exists (
    select 1
    from public.observations
    where slot_id = p_slot_id
      and user_id = v_user_id
      and status = 'SUBMITTED'
  )
  into v_has_submitted;

  if v_has_submitted then
    return jsonb_build_object(
      'error',
      'You can''t cancel this walk after submitting your report.'
    );
  end if;

  select coalesce(array_agg(o.id), '{}'::uuid[])
  into v_draft_ids
  from public.observations o
  where o.slot_id = p_slot_id
    and o.user_id = v_user_id
    and o.status = 'DRAFT';

  select coalesce(array_agg(distinct m.file_path), '{}'::text[])
  into v_file_paths
  from public.media m
  where m.observation_id = any(v_draft_ids)
     or m.sighting_id in (
       select s.id
       from public.sightings s
       where s.observation_id = any(v_draft_ids)
     );

  update public.slot_memberships
  set status = 'CANCELLED',
      cancelled_at = now()
  where id = v_membership_id;

  if v_is_late_cancellation then
    insert into public.user_audit_logs (
      user_id,
      actor_id,
      event_type,
      reason,
      slot_id,
      round_id,
      metadata
    )
    values (
      v_user_id,
      v_user_id,
      'LATE_WALK_CANCELLATION',
      v_trimmed_reason,
      p_slot_id,
      v_slot.round_id,
      jsonb_build_object(
        'location_name', v_slot.location_name,
        'walk_date', v_slot.walk_date,
        'start_time', v_slot.start_time,
        'reminder_sent_at', v_slot.reminder_sent_at
      )
    );
  end if;

  delete from public.observations
  where id = any(v_draft_ids);

  return jsonb_build_object(
    'success', true,
    'deleted_draft_count', coalesce(array_length(v_draft_ids, 1), 0),
    'file_paths', v_file_paths
  );
end;
$function$;
