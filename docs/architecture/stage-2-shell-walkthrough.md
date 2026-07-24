# Stage 2 shell walkthrough

## How to run

```bash
cd "Learner Life Cycle"
npm install
npm run dev
```

Primary mentor URL: `/learners/lifecycle`  
Use the profile **Demo account switcher** (development only) to change persona.

## What you should see

### 1. Temporary standalone chrome
- Left navy sidebar driven by **permissions / workspace** (not a fixed Overview → Administration list)
- Header with disabled global search, notification placeholders, and demo account switcher
- Footer note: “Standalone shell · design preview”

### 2. Learning & Progress Mentor — Lifecycle Board
Switch to **Reiss Chambers**. Sidebar: Learner Lifecycle, Progress Monitoring, then shared operational queues.

- Six summary metric cards (selectable via URL `?metric=`)
- Year 1 / 2 / 3 tabs
- Kanban columns for Pre-start + programme weeks
- Pinned **Overdue** column
- Learner cards link to the **shared** learner record: `/learners/[id]?from=lifecycle`

### 3. Shared learner record (all authorised roles)
Example: `/learners/lrn-liam-anderson?from=lifecycle`
- Same page structure for tutor, mentor, quality, management, administration
- Tabs via `?tab=` (Overview, Programme Progress, Reviews, Actions, Attendance, Evidence, …)
- Evidence Pack content remains on the Evidence tab
- Return link respects `from=` (e.g. back to Lifecycle Board)

### 4. Tutor / Curriculum Lead
Switch to **Daniel Turner** or **Sarah Patel**:
- Staff Workspace nav; Sarah also sees **Curriculum Management**
- Reviews / Modules open shared queues (`/reviews`, `/modules`), not role-specific copies

### 5. Workspace dashboards and stubs
Persona dashboards (`/staff/dashboard`, `/quality/dashboard`, …) and unimplemented workspace tools show prepared stubs. Operational lists that duplicate shared concepts redirect to shared queues.

## Integration readiness checks

| Check | Status |
|-------|--------|
| Feature screens do not import `src/shell` | Yes |
| Data via `LearnerLifecycleDataPort` | Yes |
| Auth via demo / AuthPort | Yes |
| One learner page for all roles | Yes (`/learners/[id]`) |
| URL preserves board view | Yes (`year`, `metric`, …) |
| Null intake fields not faked as green | Yes |
| Main Website untouched | Yes |

## Screenshots

Capture locally after `npm run dev`:

1. Mentor Lifecycle Board  
2. Shared learner record (Evidence tab) for Liam Anderson  
3. Awaiting-intake learner (Sofia Martinez)  
4. Demo account switcher with Curriculum Management visible for Sarah

Add image files under `docs/architecture/screenshots/` when available.
