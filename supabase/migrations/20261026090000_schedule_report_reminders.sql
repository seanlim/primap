-- Keep stored send times compatible with an hourly scheduler.
update public.app_settings
set reminder_send_time = date_trunc('hour', reminder_send_time)::time;
alter table public.app_settings add constraint reminder_send_time_whole_hour
  check (extract(minute from reminder_send_time) = 0 and extract(second from reminder_send_time) = 0);

create table public.report_reminder_deliveries (
  slot_id uuid not null references public.walk_slots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_day integer not null check (reminder_day in (3, 7)),
  sent_at timestamptz not null default now(),
  primary key (slot_id, user_id, reminder_day)
);
alter table public.report_reminder_deliveries enable row level security;
revoke all on public.report_reminder_deliveries from anon, authenticated;
grant select, insert on public.report_reminder_deliveries to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Vault values are provisioned separately; no credentials belong in migrations.
-- No HTTP requests are made until both secrets exist.
create or replace function public.dispatch_reminder_batches(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'Asia/Singapore';
  v_send_time time;
  v_send_day integer;
  v_app_url text;
  v_cron_secret text;
  v_headers jsonb;
begin
  select reminder_send_time, reminder_send_weekday
    into v_send_time, v_send_day from public.app_settings limit 1;
  if v_send_time is null or extract(hour from v_local) <> extract(hour from v_send_time) then
    return;
  end if;

  select decrypted_secret into v_app_url from vault.decrypted_secrets where name = 'primap_app_url';
  select decrypted_secret into v_cron_secret from vault.decrypted_secrets where name = 'primap_cron_secret';
  if nullif(v_app_url, '') is null or nullif(v_cron_secret, '') is null then
    return;
  end if;
  v_headers := jsonb_build_object('Authorization', 'Bearer ' || v_cron_secret);

  if extract(dow from v_local) = v_send_day then
    perform net.http_get(
      url := rtrim(v_app_url, '/') || '/api/cron/reminders',
      headers := v_headers,
      timeout_milliseconds := 10000
    );
  end if;

  if exists (
    select 1 from public.walk_slots s
    left join public.observations o on o.slot_id = s.id
    where s.walk_date in (v_local::date - 3, v_local::date - 7)
      and o.status is distinct from 'SUBMITTED'
  ) then
    perform net.http_get(
      url := rtrim(v_app_url, '/') || '/api/cron/report-reminders',
      headers := v_headers,
      timeout_milliseconds := 10000
    );
  end if;
end;
$$;
revoke all on function public.dispatch_reminder_batches(timestamptz) from public, anon, authenticated;

select cron.schedule(
  'primap-reminders-hourly',
  '0 * * * *',
  'select public.dispatch_reminder_batches();'
);
