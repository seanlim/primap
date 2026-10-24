-- Reports belong to the whole slot. Cancelling membership must preserve the
-- shared report, sightings, and media, even when the last participant leaves.
CREATE OR REPLACE FUNCTION public.cancel_slot_with_draft_cleanup(
  p_slot_id uuid,
  p_cancellation_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_membership_id uuid;
  v_now timestamptz := now();
  v_slot record;
  v_is_late boolean := false;
  v_reason text := nullif(btrim(p_cancellation_reason), '');
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
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

  if exists (
    select 1
    from public.observations
    where slot_id = p_slot_id
      and status = 'SUBMITTED'
  ) then
    return jsonb_build_object('error', 'You can''t cancel this walk after the shared report has been submitted.');
  end if;

  select id, round_id, walk_date, start_time, location_name, reminder_sent_at
  into v_slot
  from public.walk_slots
  where id = p_slot_id;

  if v_slot.id is null then
    return jsonb_build_object('error', 'Walk slot not found.');
  end if;

  v_is_late := v_slot.reminder_sent_at is not null;

  if v_is_late and v_reason is null then
    return jsonb_build_object('error', 'Please provide a reason for this late cancellation.');
  end if;

  if length(coalesce(v_reason, '')) > 1000 then
    return jsonb_build_object('error', 'Cancellation reason must be 1000 characters or fewer.');
  end if;

  update public.slot_memberships
  set status = 'CANCELLED',
      cancelled_at = v_now
  where id = v_membership_id;

  if v_is_late then
    insert into public.user_audit_logs (
      user_id,
      actor_id,
      event_type,
      reason,
      slot_id,
      round_id,
      metadata,
      occurred_at
    )
    values (
      v_user_id,
      v_user_id,
      'LATE_WALK_CANCELLATION',
      v_reason,
      p_slot_id,
      v_slot.round_id,
      jsonb_build_object(
        'location_name', v_slot.location_name,
        'walk_date', v_slot.walk_date,
        'start_time', v_slot.start_time,
        'reminder_sent_at', v_slot.reminder_sent_at
      ),
      v_now
    );
  end if;

  -- Keep the response compatible with the existing cancelWalk action, which
  -- removes storage files only when file_paths contains entries.
  return jsonb_build_object(
    'success', true,
    'deleted_draft_count', 0,
    'file_paths', '[]'::jsonb
  );
end;
$function$;
