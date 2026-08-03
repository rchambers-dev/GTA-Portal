# Work plan — live Autocare intake bootstrap (30 Jul 2026)

Checklist for tomorrow at GTA. Goal: get the **most recent live group** into the portal correctly, prove BRAG, then leave automation for later.

## What you need from work first

Bring back (or note down):

1. **Current / most recent Autocare L2 cohort** — official start month/date, expected end if known  
2. **Skills England / standard version** that intake started on (`1.2` vs `1.3`)  
3. **Apprentice list** — names, employers, ULNs if available, start dates  
4. **How far each learner has got** — which blocks/tasks already done (for BRAG context)  
5. **Enrolment open / quarterly start months** (for later auto-cohort rules)  
6. Ask Jon about **Skills England API key** application when ready (not blocking tomorrow)

## Portal steps (order)

### 1. Create the initial live cohort

- Management → **Cohorts & Groups**
- Create the **backdated** intake (real start date, status **active**)
- Set **standard version** correctly for that group
- Do **not** rely on auto-create yet — this first cohort is manual bootstrap

### 2. Add / enrol the apprentices

- Management → **Apprentice Intake** / **Apprentice Enrolments** as needed
- Pin each learner to **that cohort**
- Check **Apprenticeships** — card click opens apprentices; newest start dates first; line shows employer · cohort · version · started/starts

### 3. Confirm BRAG once real task evidence exists

- Open **Apprentice progression BRAG** after college task completions are in the system
- A backdated cohort with no task evidence will look mostly **Red** on past windows until verified work is recorded through normal tutor/learner flows

### 4. Spot-check (don’t deep-build automation yet)

- [ ] Apprenticeships shows the right people / versions  
- [ ] BRAG reflects cohort dates correctly  
- [ ] Cohort stays **active** (live) — planned auto-cohorts come **after** this intake is solid  

## Do tomorrow — keep light

- Wire **this one live intake** end-to-end (cohort → enrolments → BRAG check)
- Note any gaps (missing task history, unclear version, wrong start dates)

## Do **not** try to finish tomorrow

- Skills England API auto-import of new versions  
- Auto-create next quarterly cohorts  
- Auto RPL % from PLR (evidence → rules → Jon review)  
- Curriculum go-live gate (“block 4 out of date → cannot activate”)  
- Breaks in learning / end-date recalculation (that’s per-learner, not Apprenticeships)

## Product reminders (already agreed)

| Topic | Rule |
|--------|------|
| First cohort | Manual bootstrap with real dates |
| Later cohorts | Auto planned ~1 month before start once calendar is known |
| Standard version | Pinned on **cohort**; live groups don’t jump mid-course |
| Teaching materials | Curriculum lead amends in setup month; publish for the **new** cohort only |
| RPL page | Become a **queue** of outstanding assessments; Jon reviews calculated % later |
| BiL / pause | Apprentice record — **not** Apprenticeships |

## Useful routes

| Screen | Path |
|--------|------|
| Progression BRAG | `/management/apprentice-brag` |
| Cohorts | `/management/cohorts` |
| Enrolments | `/management/enrolments` |
| Apprenticeships | `/management/programmes-records` |

## Repo

- GitHub: https://github.com/rchambers-dev/GTA-Portal  
- Related live staging notes: `docs/handoff-live-staging.md`
