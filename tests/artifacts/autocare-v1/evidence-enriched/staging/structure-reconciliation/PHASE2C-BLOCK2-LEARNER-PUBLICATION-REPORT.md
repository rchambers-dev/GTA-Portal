# Phase 2C — Block 2 learner publication

**Status:** Implemented 2026-08-13. Curriculum-owner reviewed copy applied. W011–W020 `approved_published`. Authoring `publish_status=published` (Ready for delivery). **Block 3 not started.**

## Distinction

| State | Meaning | W011–W020 |
|---|---|---|
| Learner content publication | `learner_facing_content.status = approved_published` | Yes |
| Session authoring status | `publish_status = published` → Programme Builder **Ready for delivery** | Yes |
| Session delivered / learner green | `gta_session_delivery_records` | Unchanged (still 2 TEST records: W001, W002) |

Ready for delivery is the existing authoring gate once the exact tutor lesson plan is attached, reviewed learner copy is approved, and Session structure is controlled. No extra code gate exists. It is **not** learner-completed.

## Edits applied

| Session | Change |
|---|---|
| W011 | Added workshop limitations sentence. Removed “under pressure”. |
| W012 | Summary → battery/charging/starting. Activity → tutor meter demo first; not Task 3. |
| W013 | Summary → components/inspection/fault scenarios (controlled title still Engine Repairs). Activity → locate/name/tutor inspect/scenarios; not independent repair. |
| W014 | Activity → identify/observe tutor reset; not Task 4. |
| W015 | Approved as written. No formal-assessment sentence added. |
| W016 | Appended: session job card is not Block 2 Employer Job Card (Task 2). |
| W017 | Activity → identify/tutor inspect/suggest causes; not independent ABS repair. |
| W018 | Activity → observe/review with tutor; will not set alignment independently. |
| W019 | Approved as written. |
| W020 | Activity → Task 5 is Block Reflection; LIR is separate; Session does not unlock next Block. |

## Live result

- Learner status: 10/10 `approved_published`
- Authoring: 10/10 Ready for delivery
- Learner-visible Block 2 attachments: **0**
- Tutor-only Block 2 attachments: 14 (10 v4.4 LPs session-placed + 4 unplaced PDFs)
- PowerPoints attached: **0**
- Task→Session links: **0**
- Block 2 Tasks: 5, all draft, all learner **Coming up**
- Block 1: W001–W003 approved_published; W004–W010 candidate; unchanged
- Block 3 W021–W030: draft / empty learner content
- S4 unlocks: **0** (none created)
- SAFE TEST: `TEST-GTA-2026-B1DELIVERY`, programme week **3**, Block 2 calendar-locked

## Invariants

| Check | Value |
|---|---|
| Planned OTJ | 611.5 |
| Sessions | 113 |
| Controlled Tasks | 50 |
| Primaries | 0 |
| Profiles | 27 |
| TEST apprentices | 1 |
| SessionDeliveryRecords | 2 |
| Enrolment unlocks | 0 |
| Golden B | Absent |
| Assurance | Not imported |

## Tests

`src/features/programme-delivery/domain/block2-learner-publication.test.ts` plus updates to apprentice-learning, delivery-unlock, materials, and learner-session-view.

30 related tests passed.

## Unresolved (unchanged)

- No learner-visible Block 2 resource pack
- Original PowerPoint binaries missing; no HIGH-confidence Block 2 PPT placement
- Task 3 v1.0 vs catalogue v2.0
- Task 4 v1.0 vs catalogue v2.0
- W013 / W017 / W018 controlled SOW titles broader than the lesson activity (titles not “fixed”)

## Next step

Visual review as apprentice / staff Preview. **Do not start Block 3** until that review is accepted.
