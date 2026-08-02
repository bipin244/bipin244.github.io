# CCTV Installation Serial Number Manager

Static, mobile-first web app for CCTV technicians to record device serial numbers at customer sites.

**Stack:** HTML · CSS · Bootstrap 5 · jQuery · **Supabase** (Auth + Postgres)  
**Host:** GitHub Pages (no backend / no build tools)

---

## Features

- Email/password login (Supabase Auth)
- Site CRUD
- Device CRUD with barcode scanning
- **Device categories** — add / edit / delete types in Settings (used when adding devices)
- Search by serial number
- Excel / PDF / Print export
- Dark mode · mobile UI

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project  
2. Open **SQL Editor** → paste and run `supabase/schema.sql`  
3. **Authentication → Users** → Add user (email + password)  
4. **Project Settings → API** → copy **Project URL** and **anon public** key  

If you already ran an older schema, run `supabase/migration_device_types.sql` in the SQL Editor instead of the full schema.

### 2. Configure the app

Edit `js/supabase.js`:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

### 3. Auth URL (for GitHub Pages)

In Supabase → Authentication → URL Configuration, add your site URL, e.g.:

`https://YOUR_USER.github.io/Serial-Number-Manager`

### 4. Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/login.html`

---

## Project structure

```
js/
  supabase.js   # client init
  auth.js       # login / logout / requireAuth
  sites.js      # site CRUD
  categories.js # device type / category CRUD
  devices.js    # device CRUD + searchBySerial
  store.js      # session cache
  scanner.js
  export.js
  utils.js
  dashboard.js / site.js / settings.js / login.js
  app.js        # SPA router
supabase/
  schema.sql
assets/css/
index.html
login.html
```

---

## Tables

### sites

`id`, `name`, `customer`, `address`, `contact_person`, `phone`, `notes`, `created_at`

### devices

`id`, `site_id`, `device_type`, `model`, `serial_number`, `installation_date`, `remarks`, `created_at`

### device_types

`id`, `name` (unique), `icon`, `sort_order`, `created_at`

Managed in **Settings → Device Categories**. Categories come only from this table (no hardcoded list). Devices store `device_type` as text (the category name). Renaming a category updates matching devices; deleting is blocked while devices still use that name.

---

## API helpers

| Function | Description |
|----------|-------------|
| `getSites()` | List sites + device counts |
| `getSite(id)` | One site |
| `createSite(data)` / `updateSite` / `deleteSite` | Site writes |
| `getCategories()` / `createCategory` / `updateCategory` / `deleteCategory` | Category writes |
| `getDevices(siteId)` | Devices for a site |
| `addDevice` / `updateDevice` / `deleteDevice` | Device writes |
| `searchBySerial(serial)` | Partial serial search |
| `login` / `logout` / `getCurrentUser` / `requireAuth` | Auth |

Only required rows are fetched (`.eq()`, `.order()`, `.limit()`, `.select()`).

---

## Notes

- UI is unchanged from the mobile redesign; only the backend moved from JSONBin to Supabase.  
- RLS policies allow any authenticated user full access (single-team install company). Tighten later if needed.
