# Invoice Hours Manager (USD)

Personal tool to log daily hours per client and export PDF invoices for a date range.

**Stack:** HTML · Bootstrap 5 · jQuery · Supabase (Auth + Postgres) · jsPDF  
**Host:** GitHub Pages (same project as the Serial Number Manager)

---

## Features

- Clients with per-client hourly **USD** rates
- Daily hour entries (rate frozen at save time)
- Date-range PDF invoice for one client
- Invoice profile (your details on the PDF)
- Dark mode · **desktop web UI**

---

## Setup

### 1. Create tables in Supabase

Open **SQL Editor** in your existing Supabase project and run:

[`supabase/schema.sql`](supabase/schema.sql)

If you already created tables earlier, also run `supabase/migration_payment_status.sql` to add the **pending / paid** status column.

### 2. Open the app

- Local: `invoice/login.html` (or root `/invoice.html` → redirects here)
- GitHub Pages: `https://YOUR_USER.github.io/YOUR_REPO/invoice/`

Designed as a **desktop web app** (sidebar + data tables), not a mobile field tool.

---

## Usage

1. **Settings** — fill your name/email for the PDF header  
2. **Clients** — add each client + hourly USD rate  
3. **Hours** — log date, client, hours (rate prefills; you can override)  
4. **Export** — pick client + from/to dates → Download PDF  

---

## Tables

| Table | Purpose |
|-------|---------|
| `invoice_profile` | Your PDF header details |
| `invoice_clients` | Clients + `hourly_rate` |
| `invoice_entries` | Daily hours + `rate_snapshot` |

Amount on each line = `hours × rate_snapshot`. Changing a client’s rate later does not rewrite past entries.

---

## Routes

| Hash | View |
|------|------|
| `#/` | Hours entries |
| `#/clients` | Clients |
| `#/export` | PDF export |
| `#/settings` | Profile + theme + logout |
