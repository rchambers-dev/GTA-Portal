# Phase 2B.1 — Remove Groups/CEA runtime

**Date:** 2026-08-13  
**Status:** COMPLETE — STOP. Phase 2C not started.  
**Safe test context only:** `TEST-GTA-2026-B1DELIVERY` / TEST Block1 Session Delivery (SAFE DEMO)  
**Programme version:** `e8e578d5-ec0d-4de7-b9e2-5f4fa480b662`  
**controlTag:** `autocare-st0499-v1.3-phase1-controlled`

Controlled product model now:

PROGRAMME → BLOCK → SESSION → LEARNING  
+ TASKS / EVIDENCE

GROUP → GROUP TASK is no longer a supported product path.

---

## 1. Dependency inventory before Groups removal

Live read (pre-deletion, 2026-08-13):

| Object | Count | Notes |
|---|---|---|
| profiles | 27 | 26 real staff + 1 SAFE TEST apprentice login |
| apprentices | 1 | SAFE TEST only |
| enrolments | 1 | pinned to controlled version; `cohort_id = null` |
| cohorts | 0 | none |
| cea_apprentice_states | 0 | empty table |
| gta_programme_sessions | 113 | invariant held |
| gta_course_tasks | 50 | all draft; 5 per Blocks 1–10 |
| gta_session_delivery_records | 2 | W001 + W002 for SAFE TEST |
| delivery_spine = groups | 0 live rows | no cohorts exist |

No Other Portal learner data was present in this database.

---

## 2. Real data found relying on Groups

**None.**

No real apprentice, enrolment, cohort, or live programme depended on:

- `delivery_spine = "groups"`
- `AUTOCARE_CEA_PACK`
- CEA Group task definitions
- `cea_apprentice_states`
- Group task forms
- Group Progress routes

SAFE TO REMOVE. No learner evidence was destroyed.

---

## 3. Groups/CEA files / components / routes removed

Runtime deleted:

- `src/features/apprentice-portal/domain/cea/` (including `autocare-pack.ts` / `AUTOCARE_CEA_PACK`)
- `src/features/apprentice-portal/screens/ApprenticeCeaTaskScreen.tsx`
- `src/features/apprentice-portal/screens/ApprenticeGroupsTrackingScreen.tsx`
- `src/features/programme-delivery/domain/groups-progression.ts` + test
- `src/features/programme-delivery/domain/autocare-groups-forms.ts`
- `src/features/programme-delivery/domain/programme-months.ts` (CEA month-bracket dating)
- `src/features/programme-delivery/screens/TutorCeaSignOffScreen.tsx`
- `src/features/programme-delivery/screens/TutorCeaTaskReviewScreen.tsx`
- `src/features/programme-delivery/screens/TutorCeaReviewRoute.tsx`
- `src/app/api/apprentice/cea-state/`
- `src/app/api/staff/cea-sign-offs/`

Retired routes now redirect away from the old model (they do not render CEA UI):

- `/apprentice/progress/[taskId]` → `/apprentice/progress`
- `/apprentice/tracking/[taskId]` → `/apprentice/tracking`
- `/apprentice/cea`, `/apprentice/personal-tracking`, `/apprentice/modules` → `/apprentice/learning`
- `/staff/cea-sign-offs` → `/staff/programme-delivery`
- `/employer/cea-sign-offs` → `/employer/dashboard`

56 CEA Group tasks were **not** migrated into the 50 controlled Tasks.

---

## 4. Historical CEA data retained and why

`cea_apprentice_states` had **zero rows**. Table dropped in `028_phase2b1_blocks_runtime.sql`.

Historical evidence/provenance **kept** (wording “Group” is not the runtime):

- Transition Guide / source SOW artefacts
- Frozen analysis artefacts
- Historic provenance records under `tests/artifacts/`
- Old SQL `010_cea_apprentice_states.sql` (migration history only)

Decision: no historical learner evidence existed to archive. Runtime table removed.

---

## 5. Delivery-spine simplification

- `resolveApprenticeDeliveryContext` no longer returns `deliverySpine`.
- Null cohort **does not** fall back to Groups.
- Enrolment with `gta_programme_version_id` resolves the controlled Blocks programme directly.
- `normalizeDeliverySpine()` always returns `"blocks"`.
- Cohort products no longer offer a Groups product.
- Admin cohort picker Groups option removed.
- New cohorts default `delivery_spine = 'blocks'` (migration 028).
- Auth/session/profile no longer assign a Groups spine.

---

## 6. S4 implementation

Default: calendar / Session sequence unlocks Blocks (`weekStart` vs programme week). Block 1 always open.

Does **not** auto-unlock next Block:

- Task 5 / reflection verified
- all Sessions green
- any Task completion

Exception: authorised per-enrolment override only.

---

## 7. Override schema / API

Table `gta_enrolment_block_unlocks`:

- `apprentice_programme_id` (enrolment)
- `spine_item_id` (Block)
- `unlocked_by` / `unlocked_by_name`
- `unlocked_at`
- `reason` (required, non-empty)
- `created_at` / `updated_at`
- unique `(enrolment, spine_item)`

API: `POST /api/delivery/block-unlock`  
Staff only. Requires `confirm: true` + `reason`. One learner only. Auditable. No unaudited toggle.

---

## 8. Apprentice learning API

`GET /api/apprentice/learning`  
`GET /api/apprentice/learning/sessions/[sessionId]`

Identity from authenticated session `linkedApprenticeId`. Client cannot supply an arbitrary `apprenticeId`.

Resolves: apprentice → enrolment → `gta_programme_version_id` → Blocks → Sessions → this apprentice’s `SessionDeliveryRecords` → learner-visible materials only.

Tutor-only attachments never returned. `assertNoTutorOnlyLeak` fails closed.

---

## 9. `/apprentice/learning` implementation

`ApprenticeLearningScreen` is the normal learner journey.

Lane statuses assigned across the **whole** programme (not per Block), so there is one Current / next Session.

For SAFE TEST (programme week 3, W001+W002 delivered):

- Block 1 — Foundation Skills
- W001 Completed + date + Review learning
- W002 Completed + date + Review learning
- W003 Current / next (only)
- W004–W010 Upcoming

Tasks & evidence shown as a separate lane with honest “Coming up · Release not yet configured”.

---

## 10. `/apprentice/progress` implementation

High-level controlled progress only:

- programme week
- Sessions delivered
- Current / next Session
- links to My Learning and Tasks & evidence
- Block 1’s five controlled Tasks (Coming up)

No Tracker phases, Group completion, Group 1, or CEA month-bracket progression.

---

## 11. Controlled Tasks / Evidence lane

`/apprentice/tracking` → `ApprenticeProgrammeTasksScreen`

Source of truth: `gta_course_tasks` only.

Block 1 (live):

1. `b1-t1` Block 1 Knowledge Assessment (`knowledge_test`)
2. `b1-t2` Block 1 Employer Job Card (`job_card`)
3. `b1-t3` Vehicle Safety Inspection and Workshop Preparation (`practical`)
4. `b1-t4` Basic Brake and Tyre Condition Check (`practical`)
5. `b1-t5` Block 1 Reflection and Review (`reflection`)

All 50 Tasks remain draft. S7 deferred — none auto-marked Available. Retired `gN-tN` keys are filtered out if ever present (none are).

---

## 12. Tutor polish

`TutorBlock1DeliveryScreen` / `/api/delivery/block1`:

- one Current / next Session
- Activity / practice orientation
- Next Session guidance
- copy is **Session delivered** (not “Learning completed”)
- existing sign-off still means delivered only, not competence

---

## 13. Security tests

- `learner-session-materials.test.ts` — tutor-only excluded; FS01 lesson plan never returned
- `learner-session-view.test.ts` — no authoring enums / candidate LOR / tutor plans; `includesTutorLessonPlan = false`
- `apprentice-learning.test.ts` — CEA keys rejected; lesson plan titles not learner-visible
- Learning APIs bind identity from auth, not client `apprenticeId`

---

## 14. S4 tests

`delivery-unlock.test.ts` + `progression-status.test.ts`:

- verified reflection does **not** unlock next Block
- calendar/sequence unlock works
- authorised override unlocks learner A only
- learner B stays locked

---

## 15. Before / after data counts

| Object | Before | After |
|---|---|---|
| profiles | 27 | 27 (26 staff unchanged + TEST login) |
| apprentices | 1 SAFE TEST | 1 SAFE TEST |
| enrolments | 1, cohort null, pinned | unchanged |
| cohorts | 0 | 0 |
| sessions | 113 | 113 |
| tasks | 50 | 50 (`b1-t1`–`b1-t5` only for Block 1) |
| CEA Group task keys in `gta_course_tasks` | 0 | 0 |
| delivery records | 2 | 2 |
| cea_apprentice_states | 0 rows | **table dropped** |
| gta_enrolment_block_unlocks | n/a | 0 (new) |
| planned eligible OTJ | 611.5 | 611.5 |
| Primaries | 0 | 0 |
| Golden B | absent | absent |
| assurance import | not imported | not imported |

26 real staff auth/profile records were not modified. Other Portal learner data was not touched.

---

## 16. Visual walkthrough (implemented path)

Live browser screenshots were not captured in this session. The implemented SAFE TEST path is:

1. `/login` → SAFE TEST apprentice → `/apprentice/dashboard`
2. Nav: Dashboard, **My Learning**, Progress, **Tasks & evidence**, OTJ, Documents, Attendance, Reviews…
3. My Learning → Block 1
4. W001 Completed (delivery date) + Review learning
5. W002 Completed (delivery date) + Review learning
6. W003 single Current / next
7. W004–W010 Upcoming
8. Open W001 → Session page: code, focus, learner info, learner materials, activity/practice, delivered date
9. Review learning available after completion
10. Learner-visible TEST handout can appear; FS01 tutor lesson plan must not (`includesTutorLessonPlan = false`)
11. Tasks & evidence is a separate lane
12. Exactly five controlled Block 1 Tasks, all Coming up
13. No Group 1 / Tracker phases / Your group tasks / CEA Groups UI

Tutor:

14. Current / next Session clear
15. Activity / practice visible
16. Next Session guidance
17. Sign-off still = Session delivered only

---

## 17. Remaining references to the obsolete Groups curriculum model

Classified after search:

### REMOVE leftover (compat only — not a live product path)

- `DeliverySpine = "groups" \| "blocks"` type + DB column `cohorts.delivery_spine`  
  Runtime always normalizes to `blocks`. Column kept so historic/empty rows do not break.
- Redirects for `/cea-sign-offs` and `/apprentice/progress/[gN-tN]` (disable old URLs).
- `isRetiredCeaGroupTaskKey` guard + tests (prevents CEA keys resurfacing).

### HISTORICAL EVIDENCE ONLY

- `tests/artifacts/**` SOW / Transition Guide / frozen analysis
- `supabase/migrations/010_cea_apprentice_states.sql` (applied history)

### UNRELATED MEANING OF “GROUP”

- `cohort_teaching_groups` / tutor teaching groups (college-day placement)
- UI grouping / CSS group / “group by”
- Chat keyword leftovers cleaned; employer overview no longer says CEA

No `AUTOCARE_CEA_PACK`, `resolveGroupsPack`, `onGroups`, Groups Progress UI, or 56-task pack remains in runtime.

---

## 18. Deliberately deferred

- **Phase 2C** — not started
- **S7** Task release dates — not invented; honest Coming up copy only
- Task fill / submission UX for the 50 controlled Tasks
- Publishing Block 1 Tasks (all 50 remain draft)
- Learner-facing approved structured aims for most Sessions (W001 LOR is still `candidate_for_review`, so learner copy stays the honest placeholder)
- Authorised Block-unlock staff UI (API exists; no unaudited toggle)
- Employer Tasks/Evidence experience
- Full live browser screenshot pack

---

## Invariants re-checked after 028

- 611.5 planned eligible OTJ
- 113 Sessions
- 50 controlled Tasks
- 0 Primaries
- FS01–FS10 lesson-plan mappings unchanged (tutor-only, not apprentice-accessible)
- 4 intentionally unplaced Block 1 resources unchanged
- Golden B absent
- assurance not imported

**STOP. Do not start Phase 2C.**
