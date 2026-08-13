# Structure reconciliation — staging index

**Status:** Staging / control only. Not programme truth. Not Golden B.

Read-only reconciliation of Autocare structure across:

1. Other Portal (live) — discovery only  
2. GTA Portal / Programme Builder masters  
3. SOW Clean Master v4.4  

## Frozen control artefacts

| Artefact | Status | Purpose |
| --- | --- | --- |
| [AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md](./AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md) | **LOCKED** 2026-08-11 v1.0 | Human decisions H1–H9 for controlled Autocare structure before Programme Builder authoring |
| [PHASE1-CONTROLLED-BUILD-REPORT.md](./PHASE1-CONTROLLED-BUILD-REPORT.md) | Seeded draft 2026-08-11 | Phase 1 controlled programme spine/sessions/tasks build report + IDs |
| [AUTOCARE-SESSION-MODEL-DESIGN-v1.0.md](./AUTOCARE-SESSION-MODEL-DESIGN-v1.0.md) | **DESIGN SPEC — LOCKED FOR REVIEW** 2026-08-11 v1.0 | How SESSION sits between BLOCK and TASK; progression/release; Block 1 worked example — **not** implemented |
| [AUTOCARE-SESSION-MODEL-DECISIONS-S1-S8.md](./AUTOCARE-SESSION-MODEL-DECISIONS-S1-S8.md) | **LOCKED** 2026-08-11 v1.0 | Human decisions S1–S8 (SESSION meaning, TASK links, release, block unlock, visibility, OTJ, earliest timing deferral, pre-form UI gate) |
| [PHASE2A-BLOCK1-SESSION-AUTHORING-REPORT.md](./PHASE2A-BLOCK1-SESSION-AUTHORING-REPORT.md) | Implemented 2026-08-12 | Block 1 session authoring pilot — FS LP mappings, resources schema, Block panel |
| [PHASE2A1-BLOCK1-AUTHORING-UX-REPORT.md](./PHASE2A1-BLOCK1-AUTHORING-UX-REPORT.md) | Implemented 2026-08-12 | Block 1 authoring UX refinement (clarity, materials editor, demote S8) |
| [PHASE2B-BLOCK1-SESSION-DELIVERY-REPORT.md](./PHASE2B-BLOCK1-SESSION-DELIVERY-REPORT.md) | Implemented 2026-08-12 | Block 1 tutor Session delivery + sign-off pilot (TEST apprentice only) |

## Related (not superseded by H1–H9)

| Location | Note |
| --- | --- |
| `../` Track B staging catalogue | Evidence catalogue / chains — separate from structure decisions |
| `../remaining-51-plan/human-ratification-pack/` | KSB ratification / HOLDs — assurance layer; not replaced by H1–H9 |
| Cursor canvas `autocare-structure-reconciliation` | Discovery comparison UI; decisions freeze in the markdown log above |

## Rules

- Do not treat Other Portal values as controlled merely because they are live.  
- Do not build / migrate / write programme truth from this folder until separately authorised.  
- H1–H9 locks apply to future controlled Autocare structure authoring only.
