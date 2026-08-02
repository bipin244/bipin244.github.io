-- Migration: add device_types for existing Serial Number Manager projects
-- Run in: Supabase Dashboard → SQL Editor (safe to re-run)

create table if not exists public.device_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'bi-cpu',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists device_types_sort_order_idx on public.device_types(sort_order);

-- Optional: wipe seeded/default rows so you start empty and add your own
-- delete from public.device_types;

alter table public.device_types enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'device_types' and policyname = 'Authenticated read device_types'
  ) then
    create policy "Authenticated read device_types"
      on public.device_types for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'device_types' and policyname = 'Authenticated insert device_types'
  ) then
    create policy "Authenticated insert device_types"
      on public.device_types for insert to authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'device_types' and policyname = 'Authenticated update device_types'
  ) then
    create policy "Authenticated update device_types"
      on public.device_types for update to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'device_types' and policyname = 'Authenticated delete device_types'
  ) then
    create policy "Authenticated delete device_types"
      on public.device_types for delete to authenticated using (true);
  end if;
end $$;
