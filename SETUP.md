# Setting up the system for a new client

This app is a reusable template. Each client gets their **own** Supabase database,
their **own** GitHub repo + Vercel deployment, and their **own** business name
(set once in Settings → shows everywhere, including WhatsApp messages).

> Nothing is shared between clients. Data, login users, and branding are all
> per-deployment.

---

## What each client needs

1. A Supabase project (their database)
2. A GitHub repo (a copy of this template)
3. A Vercel project (their live site) connected to that repo
4. A `.env` pointing at their Supabase project
5. Their business name set in **Settings**

---

## Step 1 — Get the database schema (one time)

The schema (tables + the `auth_login` / `add_user` / `update_user` login functions
+ RLS settings) lives in the original Royani Supabase project. Export it once so it
can be reused for every new client.

**Option A — Supabase CLI (recommended, captures everything exactly):**
```bash
# Install once: https://supabase.com/docs/guides/cli
supabase login
# Get the connection string from: Supabase → Project Settings → Database → Connection string (URI)
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.mmlesejiilzphrllzums.supabase.co:5432/postgres" -f schema.sql
```
This writes `schema.sql` containing every table, type, default, constraint, function
and policy. Commit it to the repo so future clients reuse it.

**Option B — pg_dump (if you have PostgreSQL tools):**
```bash
pg_dump --schema-only --no-owner --no-privileges "postgresql://postgres:[PASSWORD]@db.mmlesejiilzphrllzums.supabase.co:5432/postgres" > schema.sql
```

> Don't hand-write the schema — the login RPCs hash passwords and must match exactly.
> A dump from the working project is the source of truth.

---

## Step 2 — New Supabase project for the client

1. https://supabase.com → New project (pick a name like `anas-hadi-poultry`)
2. Save the project's **anon key** and **URL** (Project Settings → API)
3. SQL Editor → paste the contents of `schema.sql` → Run
4. Verify the tables appear in Table Editor (farms, products, suppliers, …)

---

## Step 3 — Seed the client's starting data

In the new project's SQL Editor:

```sql
-- Admin login (change the password!). Uses the add_user function from the schema.
select add_user('Admin', 'admin', 'CHOOSE_A_STRONG_PASSWORD', 'admin');

-- Business name (also editable later in Settings → Business Info)
insert into settings (key, value) values
  ('business_name', 'Anas Hadi Poultry Services'),
  ('business_name_ps', 'انس هادي مرغداري خدمات'),
  ('usd_to_afn_rate', '70'),
  ('commission_rate_per_chicken', '5')
on conflict (key) do update set value = excluded.value;
```

---

## Step 4 — Copy the code to a new repo

**Cleanest: make this repo a GitHub "template repository"** (repo Settings → check
"Template repository"), then for each client click **Use this template → Create a
new repository**. That gives a fresh repo with no shared history.

Or manually:
```bash
# from a copy of this folder
rm -rf .git
git init
git add .
git commit -m "Initial commit — <client> poultry system"
git remote add origin https://github.com/<org>/<new-repo>.git
git push -u origin main
```

---

## Step 5 — Vercel deployment

1. https://vercel.com → New Project → import the client's repo
2. Add environment variables (Project Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = the client's Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = the client's anon key
3. Deploy.

> Keep the repo **public** on the Hobby plan, or upgrade to Pro for private repos
> (the Hobby plan blocks deploys from private repos unless the commit author is the
> Vercel account owner).

---

## Step 6 — First login & branding

1. Open the client's Vercel URL → log in with the admin user from Step 3
2. Go to **Settings → Business Info** → confirm/edit the **Business Name** (English)
   and **Business Name (Pashto)**. This drives:
   - the sidebar, header, login screen, and the logo letter
   - the receipt header
   - the signature on every WhatsApp message (English name in the English part,
     Pashto name in the Pashto part)
3. Set the **USD→AFN rate** and **Commission per chicken** for this client.

---

## Updating clients later

All clients start from this one codebase. When you fix a bug or add a shared
feature here, you can pull it into each client's repo (cherry-pick or merge). If a
client wants a unique feature, build it only in their repo.

Schema changes (new tables/columns) must be run as SQL on **each** client's Supabase
project — keep new migrations in a `migrations/` folder so they're easy to replay.
