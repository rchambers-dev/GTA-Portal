# Shared pages vs workspace pages

**Core rule:** Workspaces provide context, navigation and priorities. Shared pages represent the actual records. Permissions control what each user can view and change.

Do **not** create separate copies of the same page for different roles.

## One business object, one canonical page

| Record | Canonical route |
|--------|-----------------|
| Apprentice | `/apprentices/[apprenticeId]` |
| Employer | `/employers/[employerId]` |
| Programme | `/programmes/[programmeId]` |
| Module | `/modules/[moduleId]` |
| Review | `/reviews/[reviewId]` |
| Intervention | `/interventions/[interventionId]` |
| Action | `/actions/[actionId]` |
| Employer Concern | `/employer-concerns/[caseId]` |
| Evidence Record | `/evidence/[evidenceId]` |
| Support Plan | `/support-plans/[supportPlanId]` |
| Curriculum Feedback Item | `/curriculum-feedback/[feedbackId]` |

Shared **queues** (lists) use the plural root without an id, e.g. `/reviews`, `/interventions`, `/employer-concerns`. Queues open the same canonical record pages.

Forbidden patterns:

- `/progress-mentor/apprentices/[id]`
- `/tutor/apprentices/[id]`
- `/management/apprentices/[id]`
- `/quality/apprentices/[id]`

## Workspace-specific pages (allowed to differ)

These answer different operational questions and may stay unique:

- Learning & Progress Mentor Lifecycle Board (`/apprentices/lifecycle`)
- Tutor / Quality / Management / Administration / Employer / Apprentice dashboards
- Curriculum Management editors (`/curriculum/*`)
- Demo tools (`/management/roles`, `/employer/support`)
- Safeguarding workspace surfaces (until a shared case model exists)

The dashboard may differ by workspace; the **record page it opens must be the same**.

## Page consistency

The same record page retains the same header, tab order, section placement, terminology, status badges, timeline, and navigation behaviour across workspaces.

Permission-controlled differences only:

- Which records are accessible
- Which tabs / fields / buttons are visible or editable
- Sensitive section visibility
- Default tab, filters, programme/department scope

## Route context (`from` / `tab`)

Preserve workflow context in the query string:

| Example | Meaning |
|---------|---------|
| `/apprentices/lrn-123?from=lifecycle` | Opened from Lifecycle Board — return link to board |
| `/apprentices/lrn-123?tab=reviews&from=reviews` | Open Reviews tab |
| `/apprentices/lrn-123?tab=employer&case=case-42` | Deep-link employer section with concern context |

Do not create a duplicate learner page just to open a different tab.

## Permission enforcement

Enforce at navigation, route, server, API, query, action, field, and scope levels. Stage 2 enforces route + nav + demo scope; Stage 3+ adds API/DB/field enforcement via adapters.

Sensitive sections stay on the shared page but show a safe restricted state when the user lacks permission — never leak details in page source or API responses.

## Check before creating a page

1. Does this record already have a canonical page?
2. Can the new workspace link to that page?
3. Is the only difference a permission, filter, or action?
4. Can the difference be handled by shared components?
5. Would a new page duplicate existing information?

Only create a separate page when it serves a genuinely different operational purpose.

## Ownership

| Concern | Location |
|---------|----------|
| Route mounts | `src/app/…` |
| Shared record screens / context helpers | `src/features/shared-records/` (+ learner screens in `src/features/apprentice-lifecycle/`) |
| Workspace dashboards & demo chrome | `src/shell/workspaces/` |
| Capability strings & route guards | `src/lib/permissions/` |

Do not copy shared record components into workspace folders.

## Acceptance

- Shared records have one canonical route
- Multiple workspaces open the same record page
- Layout stays visually consistent
- Permissions alter access without duplicating the page
- Direct URL access is protected
- Workspace dashboards link into shared pages
- Context and filters are preserved between pages
- Updating one shared page updates the experience for every authorised workspace
