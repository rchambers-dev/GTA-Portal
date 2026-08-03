# Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-16 | Portable feature module under `src/features/apprentice-lifecycle` | Enables later portal integration without rewrite |
| 2026-07-16 | Temporary shell under `src/shell` + `src/app` | Development/design scaffolding only |
| 2026-07-16 | Ports/adapters for auth, session, learner data, evidence storage | Avoid tight coupling to Auth.js/Prisma in feature UI |
| 2026-07-16 | Copy Website `tokens.css` (not import across repos yet) | Reuse brand; no Website modification; shared package later if needed |
| 2026-07-16 | CSS Modules, no Tailwind | Match Website conventions |
| 2026-07-16 | Stage 2 fictional data via adapters only | No hard-coded intake assumptions; swap for real data later |
| 2026-07-16 | Defer Prisma/Auth.js wiring to Stage 3+ | Shell does not need live DB; ports define contracts now |
| 2026-07-16 | Primary operational route `/apprentices/lifecycle` | Matches manifesto; integrates as portal section later |
| 2026-07-17 | Single **Staff Workspace** with permission-driven nav sections | Tutors, mentors, and curriculum editors share one workspace; Curriculum Management is an added section when `curriculum.management.view` is granted |
| 2026-07-17 | Curriculum versioning model: Published → Draft → Edit → Review → Approve → Publish | Never overwrite published curriculum |
| 2026-07-17 | Employer concerns routed **GTA-first**; internal notes hidden from employer views | Apprentice protection principle |
| 2026-07-17 | Demo account switcher + local temporary assignments for design verification | Development/demo mode only; cookie-backed active account for SSR coherence |
| 2026-07-17 | **One business object, one canonical page** across workspaces | Workspaces differ by dashboard/nav; records share routes; permissions alter access — see `shared-pages.md` |
