# Local setup

## Prerequisites

- Node.js 20+
- Access to the Doncaster GTA Supabase project
- Dependencies: `npm install` from the repo root

## Environment

Copy `.env.example` to `.env.local` and fill values:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / SSR anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin operations |
| AI / integrations (optional) | As documented in `.env.example` |

There is no `DATA_ADAPTER` or `DEMO_MODE` switch — the portal always uses live Supabase.

Do not commit `.env.local`.

## Run

```bash
npm run dev
```

Sign in with a real portal account for that environment. Apprentice home resolves from the linked apprentice record (`/api/apprentice/me`).

## Bootstrap note

First live apprentice wiring used the Doncaster GTA Supabase project. Staff accounts are real org logins; fictional demo users have been removed.
