-- Add payment_status to existing invoice_entries
-- Run in: Supabase Dashboard → SQL Editor

alter table public.invoice_entries
  add column if not exists payment_status text not null default 'pending';

-- Backfill + constrain
update public.invoice_entries
set payment_status = 'pending'
where payment_status is null or payment_status not in ('pending', 'paid');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_entries_payment_status_check'
  ) then
    alter table public.invoice_entries
      add constraint invoice_entries_payment_status_check
      check (payment_status in ('pending', 'paid'));
  end if;
end $$;

create index if not exists invoice_entries_payment_status_idx
  on public.invoice_entries(payment_status);
