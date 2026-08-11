-- Invoice Hours Manager — Supabase schema
-- Run in: Supabase Dashboard → SQL Editor
-- Uses same Auth users as Serial Number Manager (scanner)

-- Your profile (PDF header)
create table if not exists public.invoice_profile (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default '',
  email text default '',
  phone text default '',
  address text default '',
  invoice_prefix text not null default 'INV',
  updated_at timestamptz not null default now()
);

-- Clients with hourly USD rates
create table if not exists public.invoice_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hourly_rate numeric(12, 2) not null default 0 check (hourly_rate >= 0),
  email text default '',
  address text default '',
  notes text default '',
  created_at timestamptz not null default now()
);

create index if not exists invoice_clients_name_idx on public.invoice_clients(name);

-- Daily work entries (rate_snapshot freezes rate at save time)
create table if not exists public.invoice_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.invoice_clients(id) on delete cascade,
  work_date date not null,
  hours numeric(8, 2) not null check (hours > 0),
  rate_snapshot numeric(12, 2) not null check (rate_snapshot >= 0),
  description text default '',
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create index if not exists invoice_entries_client_id_idx on public.invoice_entries(client_id);
create index if not exists invoice_entries_work_date_idx on public.invoice_entries(work_date);
create index if not exists invoice_entries_payment_status_idx on public.invoice_entries(payment_status);

-- RLS
alter table public.invoice_profile enable row level security;
alter table public.invoice_clients enable row level security;
alter table public.invoice_entries enable row level security;

create policy "Authenticated read invoice_profile"
  on public.invoice_profile for select to authenticated using (true);
create policy "Authenticated insert invoice_profile"
  on public.invoice_profile for insert to authenticated with check (true);
create policy "Authenticated update invoice_profile"
  on public.invoice_profile for update to authenticated using (true) with check (true);
create policy "Authenticated delete invoice_profile"
  on public.invoice_profile for delete to authenticated using (true);

create policy "Authenticated read invoice_clients"
  on public.invoice_clients for select to authenticated using (true);
create policy "Authenticated insert invoice_clients"
  on public.invoice_clients for insert to authenticated with check (true);
create policy "Authenticated update invoice_clients"
  on public.invoice_clients for update to authenticated using (true) with check (true);
create policy "Authenticated delete invoice_clients"
  on public.invoice_clients for delete to authenticated using (true);

create policy "Authenticated read invoice_entries"
  on public.invoice_entries for select to authenticated using (true);
create policy "Authenticated insert invoice_entries"
  on public.invoice_entries for insert to authenticated with check (true);
create policy "Authenticated update invoice_entries"
  on public.invoice_entries for update to authenticated using (true) with check (true);
create policy "Authenticated delete invoice_entries"
  on public.invoice_entries for delete to authenticated using (true);
