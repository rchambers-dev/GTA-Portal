# Work plan — live Autocare intake bootstrap (30 Jul 2026)

Checklist for tomorrow at GTA. Goal: get the **most recent live group** into the portal correctly, prove BRAG, then leave automation for later.

## What you need from work first

Bring back (or note down):

1. **Current / most recent Autocare L2 cohort** — official start month/date, expected end if known  
2. **Skills England / standard version** that intake started on (`1.2` vs `1.3`)  
3. **Learner list** — names, employers, ULNs if available, start dates  
4. **How far each learner has got** — which blocks/tasks already done (for force-complete backfill)  
5. **Enrolment open / quarterly start months** (for later auto-cohort rules)  
6. Ask Jon about **Skills England API key** application when ready (not blocking tomorrow)

## Portal steps (order)

### 1. Create the initial live cohort

- Management → **Cohorts & Groups**
- Create the **backdated** intake (real start date, status **active**)
- Set **standard version** correctly for that group
- Do **not** rely on auto-create yet — this first cohort is manual bootstrap

### 2. Add / enrol the learners

- Management → **Learner Intake** / **Learner Enrolments** as needed
- Pin each learner to **that cohort**
- Check **Programme Records** — card click opens learners; newest start dates first; line shows employer · cohort · version · started/starts

### 3. Backfill completed work (so BRAG is meaningful)

- Management → **System Actions** → **Force-complete tasks**  
  (or `/management/force-complete-tasks`)
- Needs `records.proxy.write`
- For each learner who has already finished college work:
  - Set **Completed on** to a sensible date (ideally inside the block window if you want early-finish Blue)
  - **Force-complete block** or individual tasks
- Then open **Learner progression BRAG** and confirm colours match reality

> Without step 3, a backdated cohort with no task evidence will look mostly **Red** on past windows.

### 4. Spot-check (don’t deep-build automation yet)

- [ ] Programme Records shows the right people / versions  
- [ ] BRAG moves after force-complete  
- [ ] Cohort stays **active** (live) — planned auto-cohorts come **after** this intake is solid  

## Do tomorrow — keep light

- Wire **this one live intake** end-to-end (cohort → enrolments → backfill → BRAG)
- Note any gaps (missing task history, unclear version, wrong start dates)

## Do **not** try to finish tomorrow

- Skills England API auto-import of new versions  
- Auto-create next quarterly cohorts  
- Auto RPL % from PLR (evidence → rules → Jon review)  
- Curriculum go-live gate (“block 4 out of date → cannot activate”)  
- Breaks in learning / end-date recalculation (that’s per-learner, not Programme Records)

## Product reminders (already agreed)

| Topic | Rule |
|--------|------|
| First cohort | Manual bootstrap with real dates |
| Later cohorts | Auto planned ~1 month before start once calendar is known |
| Standard version | Pinned on **cohort**; live groups don’t jump mid-course |
| Teaching materials | Curriculum lead amends in setup month; publish for the **new** cohort only |
| RPL page | Become a **queue** of outstanding assessments; Jon reviews calculated % later |
| Force-complete | Management **system action** only — not normal tutor flow |
| BiL / pause | Learner record — **not** Programme Records |

## Useful routes

| Screen | Path |
|--------|------|
| System Actions hub | `/management/system` |
| Force-complete tasks | `/management/force-complete-tasks` |
| Load learner data (progress %) | `/management/learner-data` |
| Progression BRAG | `/management/learner-brag` |
| Cohorts | `/management/cohorts` |
| Enrolments | `/management/enrolments` |
| Programme Records | `/management/programmes-records` |

## Repo

- GitHub: https://github.com/rchambers-dev/GTA-Portal  
- Related live staging notes: `docs/handoff-live-staging.md`
