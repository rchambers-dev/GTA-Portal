# Folder and route structure

## Top level

```text
Apprentice Life Cycle/
├── docs/                          # Architecture documentation (permanent)
├── prisma/                        # Schema from Stage 3 (not required for Stage 2 shell)
├── public/
├── src/
│   ├── app/                       # TEMPORARY — Next.js route mounts (workspace + shared)
│   ├── shell/                     # TEMPORARY — sidebar, header, workspace chrome
│   ├── adapters/                  # TEMPORARY implementations (fiction / later portal)
│   ├── lib/
│   │   ├── permissions/           # Capability strings, effective permissions, route guards
│   │   └── portal/                # Workspace/session types for shell
│   ├── features/
│   │   ├── learner-lifecycle/     # PERMANENT — Kanban + learner record screens
│   │   └── shared-records/        # PERMANENT — shared record stubs + context helpers
│   ├── components/ui/             # Shared primitives — portable
│   └── styles/                    # Tokens adapted from Website
├── package.json
└── README.md
```

## Import direction (enforced by convention)

```text
app / shell  →  adapters  →  features/*
                 ↑                    ↑
            implements            defines ports
```

Forbidden:
- `features/*` → `shell` or `app`
- `features/*` → Prisma client, Auth.js, or env-specific storage
- Shared record UI copied under `shell/workspaces/` or per-role folders

## Workspace pages vs shared pages

| Kind | Purpose | Examples |
|------|---------|----------|
| **Workspace** | Priorities and operational questions for a persona | Dashboards, Lifecycle Board, curriculum editors |
| **Shared record** | One canonical page per business object | `/apprentices/[id]`, `/reviews/[id]`, `/employer-concerns/[id]` |
| **Shared queue** | List/filter entry that opens shared records | `/reviews`, `/interventions`, `/employers` |

See [`shared-pages.md`](shared-pages.md).

## Canonical shared routes

| URL | Kind | Notes |
|-----|------|-------|
| `/apprentices/[apprenticeId]` | Record | Canonical learner — `?tab=` / `?from=` for context |
| `/apprentices/lifecycle` | Workspace | Mentor Lifecycle Board (links into shared learner) |
| `/employers` / `/employers/[employerId]` | Queue / record | |
| `/programmes` / `/programmes/[programmeId]` | Queue / record | |
| `/modules` / `/modules/[moduleId]` | Queue / record | Delivery-filtered for tutors |
| `/reviews` / `/reviews/[reviewId]` | Queue / record | |
| `/interventions` / `/interventions/[interventionId]` | Queue / record | |
| `/actions` / `/actions/[actionId]` | Queue / record | |
| `/employer-concerns` / `/employer-concerns/[caseId]` | Queue / record | GTA-first cases |
| `/evidence` / `/evidence/[evidenceId]` | Queue / record | |
| `/support-plans` / `/support-plans/[supportPlanId]` | Queue / record | |
| `/curriculum-feedback` / `/curriculum-feedback/[feedbackId]` | Queue / record | |

Child paths under `/apprentices/[id]/evidence|reviews|…` redirect to `?tab=` on the canonical learner URL.

## Workspace route mounts (remain unique)

| URL | Notes |
|-----|-------|
| `/` | Redirect → active workspace default |
| `/learner/*` | Signed-in **learner** workspace (not the shared record) |
| `/employer/*` | Employer workspace; `/employer/support` is demo concerns entry |
| `/staff/*` | Staff workspace; duplicate operational stubs redirect to shared queues |
| `/curriculum/*` | Curriculum Management tools |
| `/quality/*` | Quality workspace |
| `/management/*` | Management workspace (+ roles/audit demo) |
| `/administration/*` | Administration workspace |
| `/safeguarding/*` | Restricted safeguarding workspace |

Legacy roots `/dashboard`, `/admin`, `/reports` remain guarded stubs.

## URL state (Kanban)

Preserve in query string where practical:

- `year` — 1 | 2 | 3
- `from` / `span` — week window (span may be fixed to full year)
- `metric` — selected summary card
- Apprentice deep links: `from=lifecycle`, `tab=reviews|evidence|…`

Example: `/apprentices/lifecycle?year=1` → card → `/apprentices/lrn-123?from=lifecycle`
