-- Serial Number Manager — Supabase schema
-- Run in: Supabase Dashboard → SQL Editor

-- Sites
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer text not null,
  address text default '',
  contact_person text default '',
  phone text default '',
  notes text default '',
  created_at timestamptz not null default now()
);

-- Devices
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  device_type text not null,
  model text default '',
  serial_number text not null,
  installation_date date,
  remarks text default '',
  created_at timestamptz not null default now()
);

create index if not exists devices_site_id_idx on public.devices(site_id);
create index if not exists devices_serial_number_idx on public.devices(serial_number);

-- Device categories (types) — managed in Settings
create table if not exists public.device_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'bi-cpu',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists device_types_sort_order_idx on public.device_types(sort_order);

-- Enable RLS
alter table public.sites enable row level security;
alter table public.devices enable row level security;
alter table public.device_types enable row level security;

-- Authenticated users can manage all rows (single-company app)
create policy "Authenticated read sites"
  on public.sites for select to authenticated using (true);

create policy "Authenticated insert sites"
  on public.sites for insert to authenticated with check (true);

create policy "Authenticated update sites"
  on public.sites for update to authenticated using (true) with check (true);

create policy "Authenticated delete sites"
  on public.sites for delete to authenticated using (true);

create policy "Authenticated read devices"
  on public.devices for select to authenticated using (true);

create policy "Authenticated insert devices"
  on public.devices for insert to authenticated with check (true);

create policy "Authenticated update devices"
  on public.devices for update to authenticated using (true) with check (true);

create policy "Authenticated delete devices"
  on public.devices for delete to authenticated using (true);

create policy "Authenticated read device_types"
  on public.device_types for select to authenticated using (true);

create policy "Authenticated insert device_types"
  on public.device_types for insert to authenticated with check (true);

create policy "Authenticated update device_types"
  on public.device_types for update to authenticated using (true) with check (true);

create policy "Authenticated delete device_types"
  on public.device_types for delete to authenticated using (true);
