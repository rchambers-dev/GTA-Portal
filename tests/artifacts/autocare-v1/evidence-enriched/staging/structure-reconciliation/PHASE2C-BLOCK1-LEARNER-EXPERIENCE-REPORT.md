# Phase 2C — Block 1 apprentice learning + revision experience (pilot)

**Date:** 2026-08-13  
**Status:** COMPLETE — STOP. Not expanded beyond Block 1.  
**Safe test context:** `TEST-GTA-2026-B1DELIVERY` / TEST Block1 Session Delivery (SAFE DEMO)  
**Programme version:** `e8e578d5-ec0d-4de7-b9e2-5f4fa480b662`

Architecture unchanged: PROGRAMME → BLOCK → SESSION → LEARNING + TASKS / EVIDENCE.

---

## 1. Learner UX wording changes

Removed from apprentice UI:

- “Blocks, Sessions, then Tasks & evidence as a separate lane”
- “S7 deferred” / “Release not yet configured”
- “controlled programme”
- “planned eligible OTJ”
- “candidate” / authoring / QA language

Replaced with:

- My Learning: “Follow your learning journey, see what is coming next and return to completed Sessions to review your learning.”
- Block heading: **Block 1 — Foundation Skills** (display label only; DB title remains `Motor Vehicle Foundation Skills - Shared Controlled Programme`)
- OTJ: “45 planned off-the-job training hours”
- Session cards: learner title first, then `Week 1 · FS01 · W001`
- Tasks: “These tasks help you demonstrate your learning during this block. Your tutor will let you know when each task is ready to complete.”
- Unreleased Tasks: **Coming up** only

---

## 2. Session detail changes

Completed Session page (W001 / W002) now shows:

- Learner title (main)
- Codes line (secondary)
- Completed + Delivered [date]
- What you learned
- Activity / practice
- Review learning
- Tasks & evidence as a separate link (not mixed into the Session)

No authoring controls, no raw enums, no tutor lesson plans.

---

## 3. Learner-content schema / API

New column: `gta_programme_sessions.learner_facing_content` (jsonb)

```
status: empty | candidate_for_review | approved_published
candidate: { summary, learningContent, activityPractice, sourceLabel }
approved:  { …, approvedAt, approvedByName }
```

Apprentice APIs return **approved_published only**. Candidates never leak.

New: `GET /api/apprentice/learning/resources/[resourceId]`  
Auth-bound. Resource must already be on the learner journey. Tutor-only and SAFE DEMO fixture return 404/403. Binary files are not faked — extract text if available, otherwise an honest “not viewable in the portal yet” note.

---

## 4. Programme Builder authoring

Block → Session authoring now has:

- **WHAT TUTOR SEES** vs **WHAT APPRENTICE SEES**
- Source candidate labelled **CANDIDATE FROM SOURCE — REQUIRES APPROVAL**
- Editor for learner summary / learning / activity
- Copy candidate into editor
- Approve and publish for learners
- Remove from apprentice view
- Preview tab shows the same split, including learner-visible resource roles (plain language)

Jon does not edit raw database fields.

---

## 5. W001–W003 content / candidate status

| Session | Staff candidate | Apprentice published | Basis |
|---|---|---|---|
| W001 | Yes (FS01 LOR + extract activities) | **Approved** | Rewritten from FS01 aims/activity; not a lesson-plan dump |
| W002 | Yes (FS02) | **Approved** | Same rule |
| W003 | Yes (FS03) | **Approved** | Same rule |
| W004–W010 | Yes (source candidate) | **Not published** | Empty for apprentices until human approval |

W004–W010 show honest pending copy, not invented fill.

---

## 6. Resource / revision behaviour

- Approved learner copy remains available after Session completion (Review learning).
- SAFE DEMO “TEST learner handout fixture (W001)” remains in the database for security tests but is **hidden** from the normal apprentice experience.
- Genuine learner-visible resources can be opened via Review/Open resource.
- Original binaries are not claimed to open in-app.
- Task 3 / Task 4 PDFs remain unplaced (no evidence/human placement).

---

## 7. Task lane changes

Still exactly the 5 controlled Block 1 Tasks:

1. Block 1 Knowledge Assessment  
2. Block 1 Employer Job Card  
3. Vehicle Safety Inspection and Workshop Preparation  
4. Basic Brake and Tyre Condition Check  
5. Block 1 Reflection and Review  

All **Coming up**. No forms populated. No S7 release dates. Practice in a Session is not a Portal Task.

---

## 8. Security test results

192 tests passed.

Proven:

- Candidate / authoring / `candidate_for_review` do not appear in learner views
- FS01 lesson plan never returned to apprentices
- SAFE DEMO fixture filtered from production learner materials
- Approved copy is the only learner learning/activity text
- Tutor-only leak assertion still fails closed

---

## 9. Deliberately left empty (and why)

- W004–W010 apprentice learning/activity — candidates exist; not approved (empty > invented)
- Extra learner files for W001–W003 — no genuine approved handout yet; TEST fixture hidden
- Task forms — out of scope
- Task release dates — S7 deferred
- Blocks 2–10 resource mapping / KSB Session links / Primaries / Golden B / assurance — out of scope

---

## 10. Before / after invariant counts

| Object | Before | After |
|---|---|---|
| profiles | 27 | 27 (26 staff unchanged) |
| apprentices | 1 SAFE TEST | 1 SAFE TEST |
| sessions | 113 | 113 |
| tasks | 50 | 50 |
| planned OTJ | 611.5 | 611.5 |
| Primaries | 0 | 0 |
| delivery records | 2 (W001+W002) | 2 |
| learner_facing_content approved | 0 | 3 (W001–W003) |
| learner_facing_content candidates | 0 | 10 (W001–W010) |
| Golden B | absent | absent |

FS01–FS10 tutor lesson-plan mappings unchanged (still tutor-only).  
4 unplaced Block 1 resources unchanged.

---

## 11. Visual walkthrough (implemented path)

SAFE TEST apprentice:

1. My Learning intro is learner-friendly  
2. Block 1 — Foundation Skills  
3. W001 Completed (title first, codes secondary)  
4. W002 Completed  
5. W003 single Current / next  
6. W004–W010 Upcoming  
7. Open W001  
8. What you learned (approved FS01 rewrite)  
9. Activity / practice (safety walk / hazard task — not a formal Task)  
10. Review learning  
11. Open resource available where a genuine learner-visible file exists; TEST fixture hidden  
12. Tasks & evidence separate  
13. Five controlled Tasks as Coming up  
14. No S7 / technical wording  
15. No “controlled programme”  
16. No Group terminology  
17. Tutor lesson plan absent  

Programme Builder:

18. Learner-content authoring area on the Session  
19. Candidate vs approved distinction  
20. Learner resource visibility controls + tutor vs apprentice preview  

Live browser screenshots were not captured in this session.

---

## 12. Recommendation for the next controlled step

**Do not start a wide Block 2–10 content push.**

Next controlled step should be:

1. Curriculum-owner review of W001–W003 approved copy in Programme Builder (edit if needed).  
2. Human approval of W004–W010 candidates **one Session at a time** from source extracts.  
3. Only then attach genuine learner-visible/revision materials where evidence exists.

Optional later (separate approval): S7 Task release, Task form population, authorised Block-unlock staff UI.

**STOP. Phase 2C not expanded beyond the Block 1 pilot.**
