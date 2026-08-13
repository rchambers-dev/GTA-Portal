# Autocare Phase 2B — Block 1 tutor delivery + Session sign-off pilot

**Status:** Implemented · pilot  
**Date:** 2026-08-12  
**Not:** Phase 2C · Task forms · Primaries · Golden B · Blocks 2–10 · OTJ logging

## Approach (learners)

Before: `apprentices=0`, `apprentice_programmes=0`.  
Created clearly marked **TEST** apprentice only:

- Reference: `TEST-GTA-2026-B1DELIVERY`
- Name: `TEST Block1 Session Delivery (SAFE DEMO)`
- Enrolment pinned to Autocare Phase 1 programme version, `programme_week=3`
- No staff profiles modified

## Implemented

1. `gta_session_delivery_records` (status `delivered`, unique per session×enrolment)  
2. Tutor Block 1 delivery UI: `/staff/programme-delivery/block1`  
3. Confirm Session delivered (deliberate confirm; no casual undo)  
4. Learning lane: Upcoming / Current·available / Completed (green)  
5. Learner lane preview (same screen) with tutor-only filter  
6. Safe learner-visible fixture on W001 for visibility proof  
7. Same delivery timestamp allowed on W001+W002 with distinct records  

## Schema

`027_gta_session_delivery_records.sql`

## Sign-off / correction

- Tutor UI: one-way **Confirm Session delivered**  
- Re-sign refused with clear error  
- Authorised amendment trail = **future requirement** (flagged)

## Block progression (S4)

**Conflict reported (not silently fixed):**  
`delivery-unlock.ts` still auto-unlocks later blocks when prior-block reflection is verified. That conflicts with locked S4.  
**Block 1 pilot unaffected** (Block 1 is always first). Global unlock change deferred.

## Visibility proof

Learner view of W001:

- Includes TEST learner handout fixture  
- **Does not** include FS01 lesson plan (`includesTutorLessonPlan=false`)

## Invariants (after seed + demo sign-offs)

| Metric | Value |
| --- | --- |
| Staff profiles | **26** |
| OTJ | **611.5** |
| Sessions | **113** |
| Tasks | **50** |
| Primaries | **0** |
| TEST apprentices | 1 |
| TEST enrolments | 1 |
| SessionDeliveryRecords | 2 (W001+W002 TEST demo) |

## How to review

1. `/staff/programme-delivery` → Block 1 Session delivery pilot  
2. Select TEST enrolment  
3. Open W003+ as available; W001/W002 completed after demo sign-off (re-seed / new sessions as needed)  
4. Toggle Learner lane preview  

## Ready for Phase 2C?

**Conditionally yes** for a minimal learner revision experience build — after human UI review of this pilot.  
Do **not** start Phase 2C automatically.
