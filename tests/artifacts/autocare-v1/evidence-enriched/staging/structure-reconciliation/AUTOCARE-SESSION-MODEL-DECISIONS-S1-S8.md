# Autocare SESSION Model Decisions S1–S8

**Artefact type:** Staging / design control only  
**Status:** LOCKED  
**Version:** 1.0  
**Date:** 2026-08-11  
**Parent design:** [AUTOCARE-SESSION-MODEL-DESIGN-v1.0.md](./AUTOCARE-SESSION-MODEL-DESIGN-v1.0.md)  
**Related:** [AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md](./AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md)

**Not:** Programme truth · Golden A · Golden B · implementation · Primaries · assurance import · Task form authoring

Decided one-by-one with human confirmation. Implementation must not start until an explicit build go-ahead.

---

## Principles carried in

- A 10-week Block is not just five tasks  
- SESSION sits between BLOCK and the learning/activity journey  
- Tasks are evidence/assessment checkpoints around teaching and practice  
- Calendar week ≠ planned session  
- Resource→session remains nullable where unproven  
- Task 5 = block-end Reflection and Review (controlled form)  
- Prefer curriculum-controllable defaults; avoid unnecessary tutor admin  
- Learner UI must show Available / Coming up / Completed clearly  
- Preserve auditable human override where genuinely needed  

---

## S1 — What is a SESSION?

| Field | Content |
| --- | --- |
| **Decision** | A SESSION is **one planned SOW learning event** (stable key e.g. `W001`, `W112-A`). |
| **Not** | Not automatically a calendar week; not a task; not an OTJ clock entry; not a workshop register day object. |
| **Status** | **LOCKED** |
| **Choice** | A |

---

## S2 — TASK ownership

| Field | Content |
| --- | --- |
| **Decision** | TASK remains a **child of BLOCK**, with **optional TASK↔SESSION links** (supports / earliest_available_after / target / due_by / requires). |
| **Not** | TASK is not a child of SESSION; no hybrid split; not programme-only. |
| **Status** | **LOCKED** |
| **Choice** | A |

---

## S3 — Default in-block release

| Field | Content |
| --- | --- |
| **Decision** | **Session-gated by default** using authored earliest/support links, with **tutor override** (force release / hold back). |
| **Null link behaviour** | If a task has no earliest_available_after link, it becomes available when its **Block** becomes available (unless held back). |
| **Not** | Not manual-only admin; not hard T1→T5 chain; not “all published open” as the target default. |
| **Status** | **LOCKED** |
| **Choice** | A |

---

## S4 — Next Block availability

| Field | Content |
| --- | --- |
| **Decision** | **CALENDAR / SESSION-SEQUENCE DEFAULT + AUTHORISED HUMAN OVERRIDE.** |
| **Default** | Block N+1 becomes available when the controlled delivery sequence reaches it. |
| **Exception** | Tutor/trainer may unlock the next Block early for an **individual** learner for a valid delivery reason (e.g. RPL, approved accelerated pathway, catch-up/resequencing, individual circumstances). Override must be **explicit and auditable**. |
| **Explicitly rejected** | Automatic unlock of Block N+1 merely because Task 5 Reflection on Block N is verified. Task 5 is an end-of-block reflection/review checkpoint, **not** by itself a progression qualification. |
| **Also rejected** | Requiring every workplace Job Card (or all tasks) completed before the next Block opens — employer evidence may legitimately arrive later. |
| **Status** | **LOCKED** |
| **Choice** | Custom (calendar/sequence default + authorised override) |

---

## S5 — In-block task visibility

| Field | Content |
| --- | --- |
| **Decision** | Show a **roadmap**: Available (openable) · Coming up (visible but locked) · Completed. Openable only when availability rules (S3) say so. |
| **Not** | Not Other Portal-style day-one dump of openable tasks. |
| **Status** | **LOCKED** |
| **Choice** | D (implies S3 gates + visible Coming up) |

---

## S6 — Session OTJ

| Field | Content |
| --- | --- |
| **Decision** | Planned eligible OTJ remains authoritative at **BLOCK** (and programme 611.5). Session `planned_otj_hours` stays **unused / null** for now. |
| **Not** | Do not require invented per-session OTJ splits. |
| **Status** | **LOCKED** |
| **Choice** | A |

---

## S7 — Exact Task earliest sessions

| Field | Content |
| --- | --- |
| **Decision** | **Defer exact week/session numbers.** Keep only soft **PROPOSED DELIVERY RULE** bands from the design spec until Block-by-Block delivery rules are authored. |
| **Implication** | Concrete TASK↔SESSION earliest links are not curriculum-locked in this decision set; they will be authored later under S3. |
| **Status** | **LOCKED** |
| **Choice** | A |

---

## S8 — Gate before filling Task forms

| Field | Content |
| --- | --- |
| **Decision** | Before mass Task 1–5 learner content authoring, build/enable at minimum: (1) **session browser** for the 113 sessions, (2) **task↔session link editor**, (3) **availability preview** for a sample apprentice week. |
| **Not** | Do not fill all Task forms first; do not require the entire release engine before any content if A’s three pieces exist. |
| **Status** | **LOCKED** |
| **Choice** | A |

---

## Implementation consequence (when go-ahead is given)

1. Reuse `gta_programme_sessions`; expose in Programme Builder.  
2. Add TASK↔SESSION links + release/override fields.  
3. Replace automatic “prior reflection unlocks next block” with **S4** (calendar/sequence + auditable override).  
4. Learner UI: Available / Coming up / Completed (S5).  
5. Do **not** invent session OTJ splits (S6).  
6. Do **not** invent hard Autocare earliest-week tables yet (S7).  
7. Only after S8 capability: author Task forms against controlled PDFs.  
8. Still out of scope until separately authorised: Primaries, Golden B, assurance import.

---

## S8 implementation note (build go-ahead)

Minimal S8 gate delivered in Programme Builder (no Task form fill / Primaries / Golden B):

- Migration `025_gta_task_session_links.sql`
- APIs: `GET …/programme-definition/sessions`, CRUD `…/course-builder/task-session-links`
- UI panel: `SessionPlannerPanel` (session browser · links · availability preview)
- Pure preview: `task-availability-preview.ts` (S4 calendar/override; S3 session gates; S5 statuses)

**Stop after S8 gate unless further go-ahead.**
