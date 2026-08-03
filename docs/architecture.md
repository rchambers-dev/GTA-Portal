# Architecture

## Stack

- **Next.js** (App Router) frontend and API routes
- **Supabase** for auth and app data (no fictional / demo adapter)
- Feature folders under `src/features/*`, shell under `src/shell/*`

## Composition root

`src/adapters/standalone.ts` wires live Supabase ports only. Session, apprentice profile, and admin mutations go through authenticated API routes against the configured project.

## Workspaces

Portal areas are workspace-scoped routes (`/apprentice`, `/employer`, `/staff`, `/management`, `/administration`, `/quality`, `/safeguarding`). Navigation and route guards use permissions on the signed-in `PortalAccount`.

Unresolved workspace paths fall through to a stub screen (`workspace-stubs.ts`). Routes with real screens or redirects are omitted from that map.

## Apprentice delivery spines

Cohorts deliver college learning as either:

- **groups** — groups pack / personal tracking UI
- **blocks** — college tasks / block fill UI

Canonical apprentice path: `/apprentice/tracking`. Legacy paths (`/cea`, `/college-tasks`, `/modules`, etc.) redirect there. Progress and nav are spine-aware; the label stays “Personal tracking”.

## Domain blanks vs live data

`BLANK_*` helpers in apprentice-profile are empty templates / type defaults. Screens load identity from `/api/apprentice/me` and show empty operational queues until those domains are wired to Supabase.

## Standards data

Autocare (ST0499) source HTML and the KSB catalog live under `docs/standards/st0499/` and feed programme / RPL tooling — not fictional learner fixtures.
