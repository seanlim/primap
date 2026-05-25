alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists date_of_birth date,
  add column if not exists guardian_phone_number text,
  add column if not exists guardian_phone_verified_at timestamptz;

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
    select 1 from pg_constraint where conname = 'profiles_guardian_phone_number_e164_check'
  ) then
    alter table public.profiles
      add constraint profiles_guardian_phone_number_e164_check
      check (guardian_phone_number is null or guardian_phone_number ~ '^\+[1-9][0-9]{7,14}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_phone_verified_requires_phone_check'
  ) then
    alter table public.profiles
      add constraint profiles_phone_verified_requires_phone_check
      check (phone_verified_at is null or phone_number is not null);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_guardian_phone_verified_requires_phone_check'
  ) then
    alter table public.profiles
      add constraint profiles_guardian_phone_verified_requires_phone_check
      check (guardian_phone_verified_at is null or guardian_phone_number is not null);
  end if;
end $$;

update public.profiles
set
  date_of_birth = coalesce(date_of_birth, date '1990-01-01'),
  phone_number = coalesce(
    phone_number,
    '+659' || lpad(
      (
        abs(('x' || substr(md5(id::text), 1, 7))::bit(28)::int) % 10000000
      )::text,
      7,
      '0'
    )
  ),
  phone_verified_at = coalesce(phone_verified_at, now()),
  updated_at = now()
where date_of_birth is null
  or phone_number is null
  or phone_verified_at is null;

create table if not exists public.guardian_phone_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone_number text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_phone_otps_phone_number_e164_check
    check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  constraint guardian_phone_otps_attempts_check
    check (attempts >= 0)
);

create index if not exists guardian_phone_otps_user_phone_created_idx
  on public.guardian_phone_otps(user_id, phone_number, created_at desc);

alter table public.guardian_phone_otps enable row level security;
revoke all on table public.guardian_phone_otps from anon, authenticated;
grant select, insert, update, delete on table public.guardian_phone_otps to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  profile_date_of_birth date;
  raw_date_of_birth text;
begin
  raw_date_of_birth := new.raw_user_meta_data ->> 'date_of_birth';

  if raw_date_of_birth ~ '^\d{4}-\d{2}-\d{2}$'
    and raw_date_of_birth = to_char(to_date(raw_date_of_birth, 'YYYY-MM-DD'), 'YYYY-MM-DD')
  then
    profile_date_of_birth := to_date(raw_date_of_birth, 'YYYY-MM-DD');
  else
    profile_date_of_birth := null;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone_number,
    date_of_birth,
    guardian_phone_number
  )
  values (
    new.id,
    coalesce(new.email, new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    profile_date_of_birth,
    nullif(new.raw_user_meta_data ->> 'guardian_phone_number', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
    date_of_birth = coalesce(excluded.date_of_birth, public.profiles.date_of_birth),
    guardian_phone_number = coalesce(excluded.guardian_phone_number, public.profiles.guardian_phone_number),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
