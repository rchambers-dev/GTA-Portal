# Autocare SESSION Model Design

**Artefact type:** Staging / design control only  
**Status:** DESIGN SPEC — LOCKED FOR REVIEW  
**Version:** 1.0  
**Date:** 2026-08-11  
**Reference programme:** Autocare Phase 1 controlled seed  
`programmeVersionId` `e8e578d5-ec0d-4de7-b9e2-5f4fa480b662`  
**Control decisions:** [AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md](./AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md)  
**Phase 1 build:** [PHASE1-CONTROLLED-BUILD-REPORT.md](./PHASE1-CONTROLLED-BUILD-REPORT.md)

**Not:** Programme truth · Golden A · Golden B · learner records · live database writes · implementation · Primaries · assurance import

Where curriculum timing is not proven by SOW/H1–H9, items are labelled **PROPOSED DELIVERY RULE** (operational recommendation only).

---

## 0. Problem statement

Phase 1 correctly seeded:

- PROGRAMME → 12 spine items (B1–B10 blocks + B11 gateway + B12 EPA) + delivery milestones  
- 113 planned sessions in `gta_programme_sessions`  
- B1–B10 five-task slots on `gta_course_tasks`  

But live product behaviour today is effectively:

```text
PROGRAMME → BLOCK → TASK
```

Sessions exist in the database only. No Programme Builder UI, no apprentice UI, no task/session links, no resource→session bindings. Five tasks cannot carry a 10-week teaching journey; they are assessment/evidence checkpoints around teaching and practice.

This document designs how **SESSION** should sit between BLOCK and TASK **before** any further build or form authoring.

---

## 1. Recommended SESSION definition

### Decision

A **SESSION** is **one planned learning event** from the controlled SOW delivery sequence.

It is **not** automatically:

- “the same thing as a calendar week” (though Block 1 is mostly 1:1),  
- “a task”,  
- “a resource”,  
- “an OTJ clock entry”.

### Clarifying terms

| Term | Meaning |
| --- | --- |
| **SESSION** | Controlled planned learning event (SOW row / planned session). Stable key e.g. `W001`, `W112-A`. |
| **CALENDAR WEEK** | Integer programme week index (1…112). Scheduling/time context. |
| **BLOCK** | Curriculum container with week span + eligible OTJ budget + tasks + sessions. |
| **TASK** | Assessment / evidence checkpoint for a block (five-task pattern on B1–B10). |
| **TEACHING / PRACTICE** | Delivery activities inside a session (may be represented as resources + notes, not necessarily separate tables). |
| **RESOURCE** | Teaching material, practical brief, slide, demo sheet, etc. May or may not bind to a specific session. |

### Autocare reference shape

- Programme: **112 calendar weeks**, **113 planned sessions** (H3).  
- Most weeks: **one** planned session (`session_index_in_week = 1`).  
- Exception proven in SOW: Week **112** has **two** planned sessions (`W112-A`, `W112-B`).  
- Block 1: Weeks 1–10 map to FS01–FS10 (shared Foundation Skills programme referenced, not rewritten).

---

## 2. Calendar week vs planned session

### Representation

Keep both axes on every session row (already seeded):

| Field | Role |
| --- | --- |
| `calendar_week` | Programme week number |
| `session_index_in_week` | Order within that week (1, 2, …) |
| `session_key` | Stable human/machine key (`W001`, `W112-A`) |
| `sequence` | Global order in the programme version (1…113) |
| `spine_item_id` | Owning BLOCK (or null only if orphan — avoid for Autocare) |

### Rules

1. **Calendar week** answers: “When in the apprenticeship calendar is this?”  
2. **Planned session** answers: “What distinct planned learning event happens?”  
3. Unique identity for curriculum control is **`(programme_version_id, session_key)`**, not week alone.  
4. UI must always show both when `session_index_in_week > 1` or when multiple sessions share a week.  
5. Tasks and resources **must not** use “week number alone” as a foreign key where multi-session weeks exist.

### Display pattern

- Single session in week: `Week 4 · W004 · FS04 …`  
- Multi-session week: `Week 112 · Session A (W112-A)` / `Week 112 · Session B (W112-B)`

---

## 3. What belongs on a SESSION

### Required (minimum)

| Field | Notes |
| --- | --- |
| `session_key` | Stable ID |
| `sequence` | Global planned order |
| `calendar_week` | Week index |
| `session_index_in_week` | Within-week order |
| `title` | From SOW (controlled) |
| `spine_item_id` | Parent block |
| `foundation_skill_code` | Nullable; set for FS01–FS10 |

### Recommended optional (authorable later)

| Field | Notes |
| --- | --- |
| `planned_otj_hours` | Session-level split only when evidenced; else leave null and keep OTJ at block |
| `planned_non_otj_hours` | Same discipline |
| `learner_summary` | Short learner-facing blurb (not SOW inventing) |
| `tutor_notes` | Staff only |
| `completion_expectation` | Free text / enum later (`attend`, `practice`, `evidence_ready`) — **not** a learner task status |

### Explicitly NOT required on SESSION for v1 of this model

| Concept | Why not on SESSION directly |
| --- | --- |
| Full KSB ownership / Primary | Primary remains block-centred in later controlled phases; sessions get typed links later |
| The five formal Tasks | Tasks stay block children with session **links** |
| Mandatory resource list | Resources may be unbound (`session_id` null) |
| Per-session learner submission workflow | Submission is task-centric |

### Learning objectives

Prefer:

```text
SESSION 1—* LEARNING OBJECTIVE (optional rows)
```

Do **not** force LOs before controlled LO authoring exists. Nullable / empty is valid.

---

## 4. How TASK should relate to SESSION

### Recommendation (core)

**TASK remains a child of BLOCK**, with **optional relationships to SESSION(s)**.

Do **not** make TASK a child of SESSION.

### Why

1. **Workplace Job Card (Task 2)** spans a period, not one teaching day.  
2. **Reflection (Task 5)** is a block-end checkpoint.  
3. Knowledge / practical tasks often become appropriate **after several sessions**, not as “the session’s task”.  
4. Existing GTA Portal + Other Portal both model tasks at **block** grain.  
5. Session child-tasks would invent 113 micro-assessments Autocare does not have.

### Proposed task↔session link fields (design)

On task (or join table `gta_course_task_session_links`):

| Link type | Purpose |
| --- | --- |
| `SUPPORTS` / related sessions | Teaching/practice that prepare the task (many) |
| `EARLIEST_AVAILABLE_AFTER` | Session sequence/key after which task may become available |
| `TARGET` | Primary “associated” session if one exists (nullable) |
| `DUE_AFTER` / `DUE_BY` | Soft due bound to session progression (nullable) |
| `REQUIRES_SESSION` | Hard prerequisite session(s) (nullable; rare) |

Also allow **tutor manual release** to override calendaring (see §7).

### Anti-pattern (reject)

```text
Task 1 = Week 1, Task 2 = Week 2, … Task 5 = Week 5
```

That is **not** curriculum truth and must not be hard-coded.

---

## 5. Object ownership: recommended graph

### CURRENT (product behaviour)

```text
PROGRAMME
  └── BLOCK (spine item)
        └── TASK (×5 on B1–B10)
```

Sessions exist in DB but are unused by UI/delivery.

### PROPOSED (minimum maintainable)

```text
PROGRAMME VERSION
  ├── BLOCK (spine item)
  │     ├── SESSION*                    (ordered planned learning events)
  │     │     ├── LEARNING_OBJECTIVE*   (optional)
  │     │     └── RESOURCE*             (optional; nullable bind allowed)
  │     └── TASK*                       (assessment/evidence checkpoints)
  │           └── TASK↔SESSION links*   (availability / support / due; optional)
  │
  ├── DELIVERY_MILESTONE*               (GW1/GW2 — already distinct)
  └── (catalogue) STANDARD → DUTY → KSB
```

Typed KSB edges (later phase) may attach to SESSION, TASK, RESOURCE, and/or LO — see §6.

### Practice / Assessment objects

For Phase next-but-one authoring, treat **PRACTICE** and **ASSESSMENT PREPARATION** as **resource roles** (or curriculum purposes on resources/tasks), not mandatory separate entity tables:

| Role | Typical attachment |
| --- | --- |
| TEACHING_MATERIAL | SESSION (preferred) or unbound |
| PRACTICE | SESSION |
| ASSESSMENT_PREP | SESSION and/or TASK |
| CONTROLLED_FORM | TASK (`source_pdf` already seeded) |

Only introduce separate `gta_practices` / `gta_assessments` tables if Course Builder cannot express these roles cleanly.

---

## 6. Resource ↔ Session

### Rules

1. Prefer `resource.session_id` when placement is evidenced.  
2. **Nullable is correct** when evidence does not prove exact session placement (Phase 1 already allows `resource→session = NULL`).  
3. Resources may also link to TASK (e.g. practical PDF for Task 3) **without** requiring a session bind.  
4. Unbound resources appear under Block “Materials (unplaced)” until attributed.

### Roles (metadata)

```text
TEACHING | PRACTICE | ASSESSMENT_PREP | REFERENCE | CONTROLLED_FORM
```

Do not infer KSB Primaries from filenames.

---

## 7. KSB relationship model (future; do not populate yet)

### Primaries

Block-level **Primary** ownership remains a later controlled phase (not this design; not Phase 1).

### Typed relationship targets

Allow the same edge types on **more than one object type**, with clear semantics:

| Edge | Prefer attach to | Meaning |
| --- | --- | --- |
| TEACHES | SESSION (or LO) | Intentionally taught here |
| PRACTISES | SESSION / PRACTICE resource | Practised here |
| ASSESSES | TASK | Formally assessed / evidenced |
| KNOWLEDGE_CHECKS | TASK (knowledge) | Knowledge check purpose |
| RECORDS_EVIDENCE | TASK (job card / practical) | Evidence recording |
| REINFORCES | SESSION | Revisit without Primary claim |
| SUPPORTS | RESOURCE or SESSION | Supporting material |
| PREPARES_FOR_GATEWAY | SESSION / BLOCK 11 materials | Gateway prep |

### Rule

A **TASK filename or purpose tag is not a KSB claim**. Purpose tags (`KNOWLEDGE_CHECKS`, etc.) on tasks are curriculum **intent**, not ST0499 code mappings.

---

## 8. Learner progression model (capability design — not implemented)

### Layers (keep separate)

| Layer | Controls | Grain |
| --- | --- | --- |
| **A. Block availability** | Calendar week reach; optional early unlock via prior block reflection verified | BLOCK |
| **B. Task availability** | Session progress / dates / tutor release / prerequisites | TASK |
| **C. Submission lifecycle** | Work on an available task | SUBMISSION |
| **D. Block completion** | Policy on required tasks verified | BLOCK |

### Proposed learner-facing task availability states

| State | Meaning |
| --- | --- |
| `NOT_AVAILABLE` | Block locked **or** task not yet released / before earliest session |
| `AVAILABLE` | Learner may start |
| `STARTED` | Draft / in progress |
| `SUBMITTED` | Awaiting review |
| `ASSESSED` | Decision recorded (pass/return/refer) — map from existing verified/returned/referred |
| `COMPLETED` | Terminal success for that task (verified) |

### Map from current GTA Portal code (today)

**Content:** `draft` \| `published` (course builder)  
**Submission:** `not_started` \| `in_progress` \| `awaiting_mentor` \| `awaiting_trainer` \| `returned` \| `verified` \| `referred`  
**Block UI gate:** locked vs unlocked  

Today does **not** implement: released, assigned, due dates, per-task release, session-gated availability.

### Proposed availability drivers (OR / AND policy — decide before build)

Task becomes `AVAILABLE` when **block is available** AND **all** of:

1. Task `publish_status = published` and form ready (or PDF route approved), AND  
2. **One** chosen release policy:  
   - **Tutor release** (manual), and/or  
   - **Earliest session reached** (`programmeWeek` / completed sessions ≥ link), and/or  
   - **Release date** reached, and/or  
   - **Prerequisite task(s)** completed  

**PROPOSED DEFAULT for Autocare (delivery rule, not SOW truth):**

- Block unlock: keep existing calendar + prior reflection early-unlock.  
- Within block: tasks **not** all auto-open on day one.  
- Support **tutor release** + optional **earliest_available_after session**.  
- Do not require strict T1→T2→T3→T4→T5 hard chain unless staff opt in per programme.

### Completing a task

- Completing Task N does **not** automatically unlock Task N+1 unless a prerequisite link is authored.  
- Completing a block’s required set marks block complete; **next block** still follows Layer A (calendar / early reflection), not “all tasks done ⇒ next block” alone (align with desired product; Other Portal already shows all blocks).

---

## 9. Block 1 worked example

### Controlled facts (curriculum)

| Fact | Value |
| --- | --- |
| Title | Motor Vehicle Foundation Skills - Shared Controlled Programme |
| Weeks | 1–10 |
| Planned eligible OTJ | 45 |
| Non-OTJ (fixture context) | 15 |
| Sessions | W001–W010 · FS01–FS10 |
| Tasks | Five slots exist; learner form content currently empty |

### Session spine (controlled SOW titles)

| Week | Session | FS | Title (controlled) |
| --- | --- | --- | --- |
| 1 | W001 | FS01 | Workshop Safety, Hazards, Housekeeping and Occupational Expectations |
| 2 | W002 | FS02 | Health and Safety, Tools, Equipment and Safe Vehicle Support |
| 3 | W003 | FS03 | Hybrid and High-Voltage Vehicle Awareness |
| 4 | W004 | FS04 | Fire Safety, Battery Awareness and Basic Electrical Safety |
| 5 | W005 | FS05 | Measurement, Technical Information and Tolerances |
| 6 | W006 | FS06 | Fasteners, Technical Drawings, Fabrication and Safe Tool Use |
| 7 | W007 | FS07 | Multimeter Use, Electrical Measurement and Fabrication Quality |
| 8 | W008 | FS08 | Tools and Safety Consolidation, Basic Circuits and Relay Awareness |
| 9 | W009 | FS09 | Targeted Occupational Recap, Gap Teaching and First Aid |
| 10 | W010 | FS10 | Technical Documentation, Job Cards, Handover and Specialist Transition |

### Intended journey shape (teaching ≠ task)

For each session week (illustrative structure only):

```text
SESSION (FS0n)
  → TEACHING (concepts, demos, tutor-led)
  → PRACTICE (workshop practice in college)
  → WORKPLACE APPLICATION (employer context; ongoing)
  → (optional) progress toward a TASK when appropriate
```

### Task timing — PROPOSED DELIVERY RULES (not curriculum truth)

Exact week-of-release is **not** locked by SOW for Task 1–5. Until evidenced, treat as operational proposals:

| Task | Role | PROPOSED DELIVERY RULE |
| --- | --- | --- |
| **T1 Knowledge Assessment** | Checkpoint | Become available after **several** foundation sessions have been taught (e.g. earliest after W004–W006 band). Not “Week 1 task”. |
| **T2 Employer Job Card** | Workplace evidence | Available across a **workplace period** once apprentices are in placement rhythm (may open early; due toward block end). Related support: sessions that mention job cards / documentation (notably FS10). |
| **T3 Practical** | College practical assessment | After teaching/practice that prepares that practical (supports sessions to be authored when practical PDF content is confirmed). |
| **T4 Practical** | Second practical | Later than T3; after further practice sessions. |
| **T5 Reflection and Review** | Block close | Earliest near **block end** (after W009–W010 teaching; ideally after T3/T4 submitted or assessed). Controlled form: `Task_5_Block_Reflection_and_Review_v1.0.pdf`. |

### Evidence / assessment / progression (proposed)

```text
W001–W00n teaching + practice
  → T1 available → submit → assess
  → workplace application continuous → T2 evidence accumulating
  → prepared practical sessions → T3/T4 available → submit → assess
  → W010 consolidation + T5 reflection
  → block review → Layer A unlock path toward Block 2 (calendar week 11 / early unlock policy)
```

Do **not** fill Task forms until release/session-link product rules are agreed (§12).

---

## 10. Minimal schema changes (proposed for a future implementation phase)

**Do not apply in this design lock.**

### Already present (reuse)

- `gta_programme_sessions` (calendar week ≠ session index; FS code; spine FK)  
- `gta_course_tasks.source_pdf`, `evidence_ref`, `curriculum_purposes`  
- Spine metadata `weekStart` / `weekEnd` / `blockNumber`

### Minimum adds (recommended)

1. **`gta_course_task_session_links`**  
   - `task_id`, `session_id`, `link_type` (`supports` \| `earliest_available_after` \| `target` \| `due_by` \| `requires`)  
   - Unique `(task_id, session_id, link_type)`  

2. **Task availability columns** (or metadata JSON)  
   - `release_mode`: `manual` \| `session` \| `date` \| `immediate_when_block_open`  
   - `release_at` (nullable timestamptz)  
   - `manually_released_at` / `released_by` (nullable)

3. **Resource bind (when resources table is chosen)**  
   - `session_id` nullable  
   - `resource_role` enum/text  

4. **Optional session authoring fields**  
   - `learner_summary`, `tutor_notes`, `planned_otj_hours` (only when evidenced)

### Explicitly defer

- Full typed KSB edge graph population  
- Separate PRACTICE / ASSESSMENT entity sprawl  
- Learner session-attendance compulsory tracking (nice-to-have later)  
- Primaries / Golden B / HOLDs  

---

## 11. Programme Builder UI sketch (tutor / Jon)

### Block detail (primary view)

```text
Block 1 — Foundation Skills
OTJ 45 · Weeks 1–10 · 10 sessions · 5 task checkpoints

[Sessions]     [Tasks]     [Materials]     [Coverage later]

Sessions timeline:
  Week 1 · W001 · FS01 · title…
     Teaching materials: (0 unbound / n bound)
     Practice: …
     Related tasks: (none yet)
  …
  Week 10 · W010 · FS10 · …

Task checkpoints (side panel or second tab):
  T1 Knowledge — NOT LINKED / earliest after W00x (proposed)
  T2 Job Card — workplace window
  T3 Practical — PDF + supports sessions…
  T4 Practical — …
  T5 Reflection — block end
```

Jon should always see: **what is taught this session**, **resources**, **practice**, **which evidence/task is becoming due**, **what’s next**.

### Sessions browser (programme level)

Filter by block; show 113 rows; highlight multi-session weeks.

### What PB must flag today

Until UI exists: sessions are **DB-only** — authoring/inspection depends on seed + verify scripts / staging reports.

---

## 12. Learner UI sketch

### Learner sees

- Current / unlocked **block**  
- **Upcoming / available sessions** as “this week’s college focus” (titles from SOW)  
- **Tasks** in states: Not available / Available / In progress / Submitted / Completed  
- Controlled forms only when task AVAILABLE  
- Not a dump of all future block tasks if release rules are enabled  

### Learner does not need

- Tutor notes  
- Primary/KSB graph  
- Unplaced resource admin queues  

### Tutor / trainer sees

- Same journey + release controls  
- Manual release toggles  
- Review queues for submitted tasks  
- Block calendar position  

---

## 13. Decisions required before implementation

**Resolved 2026-08-11** — see [AUTOCARE-SESSION-MODEL-DECISIONS-S1-S8.md](./AUTOCARE-SESSION-MODEL-DECISIONS-S1-S8.md).

| ID | Locked outcome |
| --- | --- |
| **S1** | SESSION = planned SOW learning event |
| **S2** | TASK child of BLOCK + optional SESSION links |
| **S3** | Session-gated default + tutor override |
| **S4** | Calendar/session-sequence default + auditable human override; **not** auto from T5 |
| **S5** | Roadmap: Available / Coming up (locked) / Completed |
| **S6** | OTJ authoritative at BLOCK; session OTJ null |
| **S7** | Defer exact earliest sessions; soft PROPOSED bands only |
| **S8** | Session browser + link editor + availability preview before mass form fill |

### Recommended gate before authoring all Task content

1. Lock S1–S3.  
2. Implement **read-only session browser** in Programme Builder (show the 113).  
3. Implement **task↔session link + release_mode** (even if default remains open).  
4. Preview apprentice availability for Block 1.  
5. **Then** author Task 1–5 forms/content against controlled PDFs.

---

## 14. Summary answers (checklist)

1. **SESSION** = one controlled planned learning event (SOW row), not automatically a week or a task.  
2. **Week vs session** = dual fields; Week 112 proves multiplicity.  
3. **Relationships** = BLOCK owns SESSION* and TASK*; TASK↔SESSION links; RESOURCE→SESSION nullable.  
4. **Task model** = child of BLOCK, not SESSION.  
5. **Resources** = prefer session bind; null allowed.  
6. **KSBs** = typed edges later on session/task/resource/LO; Primaries later at block.  
7. **Progression** = block layer + task availability layer + submission lifecycle.  
8. **Block 1** = FS01–FS10 teaching/practice weeks; tasks are checkpoints with **PROPOSED** timing only.  
9. **Schema** = reuse sessions table; add link table + release fields.  
10–11. **UI** = block timeline + task checkpoints (tutor); available sessions + gated tasks (learner).  
12. **Decide S1–S8 before build / before mass form authoring.**

---

**Stop condition:** Design only. No implementation. No Primaries. No Golden B. No Task content population.
