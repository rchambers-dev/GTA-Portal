# Permissions matrix (Phase 1)

Enforcement must be **server-side** via the auth/RBAC adapter. UI hiding is not sufficient.

## Roles

| Code | Label |
|------|-------|
| `administrator` | Administrator |
| `senior_manager` | Senior manager |
| `mentor` | Learning and progress mentor |
| `tutor` | Tutor |
| `reviewer` | Reviewer / quality assurer |
| `employer` | Employer representative |
| `learner` | Learner |
| `support` | Support staff |
| `auditor` | Read-only auditor / inspector |

## Capability matrix

Legend: **F** = full · **A** = assigned/linked learners only · **R** = read · **W** = write · **—** = none · **S** = sensitive fields restricted

| Capability | Admin | Sr Mgr | Mentor | Tutor | Reviewer | Employer | Learner | Support | Auditor |
|------------|-------|--------|--------|-------|----------|----------|---------|---------|---------|
| View lifecycle Kanban | F | F | A | A | F | A | — | A | F |
| View learner workspace | F | F | A | A | F | A* | Own | A* | F |
| Upload / link evidence | F | F | A | A | A | Limited† | Own† | — | — |
| Mark evidence Received | F | F | A | A | A | — | — | — | — |
| Mark evidence Checked | F | F | A | Limited‡ | F | — | — | — | — |
| Mark Not applicable (+ reason) | F | F | A | — | F | — | — | — | — |
| Create / assign tasks | F | F | A | A | A | Limited | Limited | — | — |
| Complete own tasks | F | F | A | A | A | A | Own | — | — |
| Revise planned end date | F | F | —§ | — | — | — | — | — | — |
| View timeline | F | F | A | A | F | A* | Own* | A* | F |
| View audit trail | F | F | A | Limited | F | — | — | — | F |
| View sensitive support notes | F | F | S | — | S | — | — | S | S |
| Admin config / frameworks | F | R | — | — | — | — | — | — | — |
| Inspection read-only mode | — | R | — | — | R | — | — | — | F |

\* Employer/learner visibility of evidence types TBD (Q15).  
† Statements and permitted uploads only; not staff judgements.  
‡ Tutor check scope TBD (Q5).  
§ Mentor date change may require senior approval (Q6).

## Card-front rule

No role may surface safeguarding detail on Kanban cards. Display-safe text only, e.g. “Restricted welfare action requires attention.”

## Adapter contract

```ts
can(user, permission, resource?): boolean
assertCan(user, permission, resource?): void  // throws / returns ActionError
scopeLearners(user): Filter                      // assigned / employer / all
```

Stage 2 placeholder session: demo auth adapter with nine accounts. Navigation and route access derive from **permission capability strings** in `src/lib/permissions/capabilities.ts` — not from display names.

### Staff workspace (implemented in shell demo)

- **Base staff nav:** dashboard, my learners (lifecycle board), schedule, modules (shared `/modules`), assessments, reviews (shared `/reviews`), resources, curriculum feedback, messages
- **Curriculum Management section** (additional): when user holds the curriculum editor permission pack (`curriculum.management.view`, `curriculum.edit`, …) — Sarah Patel has this scoped to **Accident Repair Technician**; Daniel Turner does not until Management grants temporary access
- **Mentor nav variant:** Lifecycle Board + progress monitoring; operational lists open **shared queues** (`/reviews`, `/interventions`, `/actions`, `/employers`, `/employer-concerns`, `/support-plans`) — not `/staff/…` copies

### Shared record access

All authorised roles open the same canonical paths (e.g. `/learners/[id]`). Tutor / mentor / quality / management / administration differ by permission, field visibility, and actions — not by separate page copies. See `docs/architecture/shared-pages.md`.

### Employer workspace

- Employer Support & Concerns: Ask GTA, Raise a Concern, Request Support, Clarify Learner Progress
- GTA staff manage cases; employers never see internal safeguarding or case notes

### Temporary responsibilities (demo)

Management may grant time-limited Curriculum Editor permissions with programme scope and expiry. Expired or revoked assignments are ignored automatically. Audit events append to local demo storage.
