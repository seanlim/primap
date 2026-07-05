alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists birth_month date;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'date_of_birth'
  ) then
    execute $sql$
      update public.profiles
      set birth_month = date_trunc('month', date_of_birth)::date
      where birth_month is null
        and date_of_birth is not null
    $sql$;
  end if;
end $$;

alter table public.profiles
  drop column if exists date_of_birth,
  drop column if exists guardian_phone_number,
  drop column if exists guardian_phone_verified_at;

alter table public.survey_rounds
  add column if not exists indemnity_form_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_phone_number_e164_check'
  ) then
    alter table public.profiles
      add constraint profiles_phone_number_e164_check
      check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{7,14}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_phone_verified_requires_phone_check'
  ) then
    alter table public.profiles
      add constraint profiles_phone_verified_requires_phone_check
      check (phone_verified_at is null or phone_number is not null);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_birth_month_first_day_check'
  ) then
    alter table public.profiles
      add constraint profiles_birth_month_first_day_check
      check (birth_month is null or birth_month = date_trunc('month', birth_month)::date);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'survey_rounds_indemnity_form_url_check'
  ) then
    alter table public.survey_rounds
      add constraint survey_rounds_indemnity_form_url_check
      check (
        indemnity_form_url is null
        or indemnity_form_url ~* '^https?://'
      );
  end if;
end $$;

update public.survey_rounds
set
  indemnity_form_url = coalesce(
    indemnity_form_url,
    'https://docs.google.com/forms/d/e/1FAIpQLSeyEo0vrWJVWliNvA5Q9xaz1CX7dimhJlRYUbojbbLO9ewtBQ/viewform'
  ),
  updated_at = now()
where status in ('DRAFT', 'OPEN')
  and indemnity_form_url is null;

create table if not exists public.round_participation_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_id uuid not null references public.survey_rounds(id) on delete cascade,
  indemnity_acknowledged_at timestamptz,
  guardian_name text,
  guardian_email text,
  guardian_email_verified_at timestamptz,
  guardian_phone_number text,
  guardian_phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint round_participation_requirements_user_round_key unique (user_id, round_id),
  constraint round_participation_requirements_guardian_name_check
    check (guardian_name is null or length(trim(guardian_name)) > 0),
  constraint round_participation_requirements_guardian_email_check
    check (
      guardian_email is null
      or (
        guardian_email = lower(guardian_email)
        and guardian_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      )
    ),
  constraint round_participation_requirements_guardian_phone_e164_check
    check (guardian_phone_number is null or guardian_phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  constraint round_participation_requirements_guardian_email_verified_requires_email_check
    check (guardian_email_verified_at is null or guardian_email is not null),
  constraint round_participation_requirements_guardian_phone_verified_requires_phone_check
    check (guardian_phone_verified_at is null or guardian_phone_number is not null)
);

create index if not exists round_participation_requirements_round_user_idx
  on public.round_participation_requirements(round_id, user_id);

alter table public.round_participation_requirements enable row level security;
revoke all on table public.round_participation_requirements from anon, authenticated;
grant select, insert, update, delete on table public.round_participation_requirements to service_role;

drop table if exists public.guardian_phone_otps;

create table if not exists public.guardian_contact_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_id uuid not null references public.survey_rounds(id) on delete cascade,
  channel text not null,
  destination text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_contact_otps_channel_check
    check (channel in ('EMAIL', 'SMS')),
  constraint guardian_contact_otps_attempts_check
    check (attempts >= 0),
  constraint guardian_contact_otps_destination_check
    check (length(trim(destination)) > 0)
);

alter table public.guardian_contact_otps
  add column if not exists round_id uuid;

delete from public.guardian_contact_otps
where round_id is null;

alter table public.guardian_contact_otps
  alter column round_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'guardian_contact_otps_round_id_fkey'
  ) then
    alter table public.guardian_contact_otps
      add constraint guardian_contact_otps_round_id_fkey
      foreign key (round_id) references public.survey_rounds(id) on delete cascade;
  end if;
end $$;

create index if not exists guardian_contact_otps_lookup_idx
  on public.guardian_contact_otps(user_id, round_id, channel, destination, created_at desc);

alter table public.guardian_contact_otps enable row level security;
revoke all on table public.guardian_contact_otps from anon, authenticated;
grant select, insert, update, delete on table public.guardian_contact_otps to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  profile_birth_month date;
  raw_birth_month text;
  candidate_birth_month text;
begin
  raw_birth_month := coalesce(
    nullif(new.raw_user_meta_data ->> 'birth_month', ''),
    nullif(new.raw_user_meta_data ->> 'date_of_birth', '')
  );

  if raw_birth_month ~ '^\d{4}-\d{2}$' then
    candidate_birth_month := raw_birth_month || '-01';
  elsif raw_birth_month ~ '^\d{4}-\d{2}-\d{2}$' then
    candidate_birth_month := to_char(to_date(raw_birth_month, 'YYYY-MM-DD'), 'YYYY-MM') || '-01';
  else
    candidate_birth_month := null;
  end if;

  if candidate_birth_month is not null
    and candidate_birth_month = to_char(to_date(candidate_birth_month, 'YYYY-MM-DD'), 'YYYY-MM-DD')
    and candidate_birth_month <= to_char(current_date, 'YYYY-MM') || '-01'
  then
    profile_birth_month := to_date(candidate_birth_month, 'YYYY-MM-DD');
  else
    profile_birth_month := null;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone_number,
    birth_month
  )
  values (
    new.id,
    coalesce(new.email, new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    profile_birth_month
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
    birth_month = coalesce(excluded.birth_month, public.profiles.birth_month),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
