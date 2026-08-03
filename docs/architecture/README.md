# GTA Apprentice Lifecycle — Architecture

**Status:** Stage 2 shell + permission-driven demo workspaces  
**Integration intent:** Temporary standalone shell → later embed into main GTA portal  
**Last updated:** 2026-07-17

---

## 1. Product boundary

| Layer | Permanence | Purpose |
|-------|------------|---------|
| **Standalone shell** (`src/shell`, `src/app`) | Temporary | Local navigation, layout chrome, and route mounting for development and design approval |
| **Apprentice Lifecycle feature** (`src/features/apprentice-lifecycle`) | Permanent | Kanban, learner cards, workspace, Evidence Pack UI and domain rules |
| **Adapters** (`src/features/apprentice-lifecycle/ports` + `src/adapters`) | Ports permanent; implementations replaceable | Auth, user context, and data access — swap fiction → portal real services |

The main GTA Website/portal must **not** be modified during Stages 1–2.

---

## 2. Repository assessment (Stage 0 summary)

| Area | Finding |
|------|---------|
| This folder | Greenfield; now scaffolded as portable module |
| Sibling Website | Next.js 15 marketing site; CSS tokens and portal stub only |
| Auth / DB in Website | None |
| Decision | Build here as modular feature; integrate into portal after UX approval |

Full comparison to the manifesto is in `docs/architecture/decision-log.md`.

---

## 3. Stack

- Next.js (App Router), TypeScript strict
- PostgreSQL + Prisma (schema from Stage 3; Stage 2 uses fictional adapters)
- Auth.js (wired via auth port; Stage 2 uses placeholder session)
- Zod validation
- CSS Modules + Website design tokens (`src/styles/tokens.css`)

---

## 4. Modularity rules

1. Feature components must not import from `src/shell` or `src/app`.
2. Feature code depends only on **ports** (interfaces), not Prisma/Auth.js directly.
3. Standalone shell composes feature pages and injects adapter implementations.
4. On portal integration: replace shell + adapters; move `src/features/apprentice-lifecycle` (and shared UI primitives) unchanged where possible.
5. URL shape under the feature should stay stable (`/apprentices/lifecycle`, `/apprentices/[id]/…`) so deep links survive remounting.

---

## 6. Demo workspaces (development only)

The standalone shell includes a **permission-driven workspace demonstrator**:

- Nine demo accounts (learner, employer, staff, quality, management, administration, safeguarding) in `src/adapters/fictional/demo-accounts.ts`
- Effective permissions from base account + active temporary assignments (`src/lib/permissions/`)
- Sidebar navigation generated from permissions — not hard-coded names (`src/shell/workspaces/resolve-navigation.ts`)
- Development-only account switcher in the profile menu (`NODE_ENV=development` or `NEXT_PUBLIC_DEMO_MODE=true`)
- Temporary responsibility grants with expiry, revocation, and local audit log (Management → Roles & Responsibilities)
- Route guards block direct URLs when permissions or programme scope do not allow access

**Production safety:** demo switcher and local assignment state are disabled outside development/demo mode; production falls back to the default session adapter behaviour.

---

## 7. Shared pages vs workspace pages

Workspaces provide **context, navigation and priorities**. Shared pages represent **records**. Permissions control what each user can view and change.

- One business object → one canonical route (e.g. `/apprentices/[apprenticeId]` for every authorised role)
- Workspace dashboards and the Lifecycle Board stay unique
- Do not create role-prefixed copies (`/tutor/apprentices/…`, `/management/apprentices/…`)

Full rules, route table, and “check before creating a page” checklist: [`docs/architecture/shared-pages.md`](shared-pages.md).

---

## 5. Related documents

| Document | Path |
|----------|------|
| Folder & routes | `docs/architecture/folder-and-routes.md` |
| Shared pages | `docs/architecture/shared-pages.md` |
| ERD / schema proposal | `docs/architecture/erd.md` |
| Permissions matrix | `docs/architecture/permissions-matrix.md` |
| Kanban strategy | `docs/architecture/kanban-strategy.md` |
| Evidence storage | `docs/architecture/evidence-storage.md` |
| Decision log | `docs/architecture/decision-log.md` |
| Q&D register | `docs/questions-and-decisions.md` |
| Stage 2 shell walkthrough | `docs/architecture/stage-2-shell-walkthrough.md` |
| Risks & assumptions | `docs/architecture/risks-and-assumptions.md` |
