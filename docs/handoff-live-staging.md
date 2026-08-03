# Handoff — live staging (28 Jul 2026)

Pick up here on another PC. Secrets stay out of git; recreate `.env.local` from Vercel / provider dashboards.

## Goal

Stage the portal for **live data**: Supabase auth + DB, management proxy-write for learner records, real Autocare course content kept, fictional demo path only when explicitly enabled.

## What’s already done in code

- Env contract documented in `.env.example`; no implicit “Vercel = demo”
- Supabase adapters: `src/adapters/supabase/{client,auth,learner-data}.ts`
- Adapter switch in `src/adapters/standalone.ts` (`DATA_ADAPTER` + demo flag)
- Login / logout: `/login`, `src/app/logout/actions.ts`
- hCaptcha wired on login (`@hcaptcha/react-hcaptcha` + `captchaToken` on `signInWithPassword`)
- SQL bootstrap: `supabase/migrations/001_portal_bootstrap.sql`
- Cohorts / teaching groups: `supabase/migrations/002_cohorts_and_teaching_groups.sql`
- SuperAdmin bootstrap script: `npm run bootstrap:superadmin`
- Migration helper (needs DB password): `node scripts/run-migration.mjs` (applies all pending `supabase/migrations/*.sql`)
- `records.proxy.write` capability + management UI + API
- Progress framing from start / planned end / actual %
- Admin live store path when demo is off

## Repo / deploy

- GitHub: `https://github.com/rchambers-dev/GTA-Portal`
- Vercel project: `gta-portal` (team `gta-portal`)
- Live URL: `https://gta-portal.vercel.app`
- Supabase project URL: `https://cjtgjxgghfiskqnuttzd.supabase.co`

## Env vars required (do not commit values)

Copy `.env.example` → `.env.local`, then fill from Vercel Production or provider dashboards:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE=false` | local / Vercel |
| `DATA_ADAPTER=supabase` | local / Vercel |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable / anon key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret (`sb_secret_…`) |
| `AI_PROVIDER=openai` | local / Vercel |
| `AI_API_KEY` | OpenAI |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | hCaptcha **site** key (UUID, e.g. `fb20424a-…`) |
| `HCAPTCHA_SECRET_KEY` | hCaptcha **account secret** (`ES_…`) |
| `GIPHY_API_KEY` | Giphy |
| `SUPABASE_DB_PASSWORD` | only for running `scripts/run-migration.mjs` locally |

**hCaptcha note:** `ES_…` is the **secret**, not the sitekey. Sitekey comes from the created Site in the hCaptcha dashboard.

**Supabase Auth:** Authentication → Captcha / Bot protection → provider **hCaptcha**, secret = `ES_…`.

Fast local pull (values may come back as `[SENSITIVE]` depending on permissions):

```bash
npx vercel link --yes --scope gta-portal --project gta-portal
npx vercel env pull .env.local
```

Then edit `.env.local` if placeholders appear — paste real keys manually.

## Login (after DB + bootstrap)

- Email: `superadmin@gta-portal.local`
- Username label in UI: `SuperAdmin`
- Password: set via `BOOTSTRAP_SUPERADMIN_PASSWORD` when running bootstrap (previously used locally: ask Reiss / password manager — do not assume it is still valid)

```powershell
$env:BOOTSTRAP_SUPERADMIN_PASSWORD="your-password-here"
npm run bootstrap:superadmin
```

## Where we left off

1. **Dev server** was running locally with live mode + real env keys.
2. **Login captcha** was failing because sitekey was wrong (`ES_…`); fixed to real sitekey `fb20424a-d7a4-4134-aea2-8a180ff6771a` in `.env.local` + Vercel. Refresh `/login` and complete captcha.
3. **SQL migrations** may still need applying if tables are missing:
   - Preferred: Supabase → SQL Editor → run each file in `supabase/migrations/` in order (`001_…`, then `002_…`)
   - Or: set `SUPABASE_DB_PASSWORD` and run `node scripts/run-migration.mjs`
4. **SuperAdmin bootstrap** only works after migration succeeds.
5. Confirm Supabase captcha settings use the hCaptcha secret.

## Quick start on another PC

```powershell
git clone https://github.com/rchambers-dev/GTA-Portal.git
cd GTA-Portal
npm install
# create .env.local (see table above) — never commit it
npm run dev
```

Then verify `/login` loads captcha → sign in after migration + bootstrap.

## Intentionally not done yet

- Full ADM14 persistence
- Live LRS SOAP / PICS
- Remaining seven programmes beyond Autocare pattern
- Full mentor mock retirement
- getAddress.io key (optional; Nominatim fallback works)

## Useful paths

- Login UI: `src/app/login/`
- Supabase clients: `src/adapters/supabase/`
- Migration SQL: `supabase/migrations/` (`001_portal_bootstrap.sql`, `002_cohorts_and_teaching_groups.sql`)
- Proxy write UI: `src/features/administration/screens/ManagementProxyWriteScreen.tsx`
- Env docs: `.env.example`
