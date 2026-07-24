# Questions and Decisions Register

Unresolved questions must not be silently decided in code. Record decisions here when resolved.

## Decisions (resolved)

| ID | Decision | Date | Notes |
|----|----------|------|-------|
| D1 | Build Learner Lifecycle as a **standalone modular app** in this folder for design approval | 2026-07-16 | Not a permanently separate product |
| D2 | After UX approval, **integrate into the main GTA portal** as a page/section | 2026-07-16 | Connect real auth, roles, learner data afterwards |
| D3 | Separate temporary shell from permanent feature; replaceable adapters for auth/data | 2026-07-16 | See architecture README |
| D4 | Do **not** modify the existing Website/portal during Stages 1–2 | 2026-07-16 | |
| D5 | Stack: Next.js App Router, TS strict, Postgres, Prisma, Auth.js, Zod, CSS Modules + Website tokens | 2026-07-16 | |
| D6 | Kanban: year tabs, 156 weeks, windowed/virtualised, pinned Overdue, URL filters | 2026-07-16 | |
| D7 | Evidence: requirement-linked, immutable versions, Received ≠ Checked, audit+timeline | 2026-07-16 | |
| D8 | Stage 2 = documentation + shell only | 2026-07-16 | Fictional placeholder data via adapters |
| D9 | Kanban week columns use “Week N” + Mon–Sun date range (week commencing) | 2026-07-16 | Superseded by D10 for multi-cohort boards |
| D10 | Board columns are **elapsed programme weeks from each learner’s start date**; viewing label shows today’s date; column headers do not show a shared calendar date (misleading across start dates) | 2026-07-16 | Placement via `calculateProgrammeWeek`; BiL still open (Q17) |
| D11 | **One Staff Workspace** for all teaching staff; navigation grows by permissions | 2026-07-17 | Curriculum Management is a sidebar section, not a separate dashboard |
| D12 | Curriculum Lead owns content; Management creates programmes; tutors deliver **published** curriculum only | 2026-07-17 | Version workflow documented in decision log |
| D13 | Employer concerns go to **GTA first**, not directly to learners | 2026-07-17 | Employer Support & Concerns mock in shell |
| D14 | Demo account switcher enabled only in development or `NEXT_PUBLIC_DEMO_MODE=true` | 2026-07-17 | Production uses normal auth adapter path |
| D15 | **One business object, one canonical page** — workspaces link into shared record routes | 2026-07-17 | See `docs/architecture/shared-pages.md`; no role-prefixed duplicate learner pages |

## Open questions

| ID | Question | Blocking? | Notes |
|----|----------|-----------|-------|
| Q1 | What is the longest confirmed programme length? | Soft | Assume 156 weeks until confirmed |
| Q2 | Are all programmes mapped by week or by planned milestones? | Soft | Week-based placement for Phase 1 |
| Q3 | What is GTA’s official meaning of M and O? | Soft | Treat as Mandatory / Conditional (where applicable) |
| Q4 | Which evidence items require formal signatures? | Soft | Auth sign-off default; formal e-sign later |
| Q5 | Which roles may mark evidence as checked? | Medium | Matrix draft: mentor, reviewer, admin; tutor limited |
| Q6 | Which staff may change planned programme dates? | Medium | Draft: admin + senior manager |
| Q7 | How is attendance currently sourced? | Soft | Phase 1 summary may be stub / Unknown |
| Q8 | How are reviews currently scheduled? | Soft | |
| Q9 | What is PEDS in GTA’s process? | Soft | |
| Q10 | What is the confirmed meaning of the second T in SMARTTO? | Soft | |
| Q11 | Which information is currently stored in the existing portal? | Soft | Portal is stub today |
| Q12 | Is there an existing learner identifier that must remain canonical? | Medium | Use opaque `learnerId` until confirmed |
| Q13 | Which records have statutory or contractual retention periods? | Soft | Soft-delete/archive until known |
| Q14 | Which health-and-safety inspection schedule applies? | Soft | Recurring collection model ready |
| Q15 | Which evidence files may employers or learners view? | Medium | Restrict until confirmed |
| Q16 | What constitutes Gateway-ready for each programme? | Soft | Status enum only in Phase 1 |
| Q17 | How should a break in learning affect programme-week calculations? | Medium | Flag Unknown when BiL present until rule set |
| Q18 | How should changed employers affect employer commitments? | Soft | |
| Q19 | Which users may see sensitive support and concern records? | Medium | See permissions matrix |
| Q20 | Which existing systems need future integration? | Soft | |
| Q21 | Preferred production auth (Auth.js credentials, Entra ID, etc.)? | Medium | Auth.js port; provider TBD |
| Q22 | Hosting, Postgres, and object-storage targets? | Soft | Local adapters until known |
| Q23 | Exact portal URL prefix after integration (`/portal/…`)? | Soft | Keep feature-relative paths stable |
| Q24 | Should column dates follow a shared academic calendar, filtered programme start, or stay illustrative until cohort filters exist? | Soft | Shell uses Week 1 Monday anchor (2024-06-03); multi-start cohorts make one date range per column imperfect |

## How to use

When implementing, if a field or rule is unresolved: show **Unknown / Not yet recorded / Awaiting intake**, add a note here, and avoid inventing regulatory meaning.
