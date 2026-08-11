# Autocare Phase 1 — controlled Programme Builder build

**Status:** Seeded · draft · awaiting human visual review  
**Date:** 2026-08-11  
**Control tag:** `autocare-st0499-v1.3-phase1-controlled`  
**Decisions:** [AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md](./AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md)

## IDs

| Object | ID |
| --- | --- |
| Programme | `99265585-a970-434e-994b-637735747ae1` |
| Programme version | `e8e578d5-ec0d-4de7-b9e2-5f4fa480b662` |
| Spine | `acec5bf0-947c-4bda-b958-f38489a49799` |

## Built

- Programme: **Autocare Technician Level 2** · ST0499 v1.3 · planned eligible OTJ **611.5** (published min context **605**)
- Spine: Blocks 1–10 (SOW titles) · B11 Gateway Readiness · B12 EPA · delivery milestones GW1/GW2 (`item_type=milestone`)
- Sessions: **113** planned sessions across **112** calendar weeks (W112 A+B)
- Tasks: **50** on B1–B10 (Knowledge / Job Card / Practical / Practical / Reflection)
- KSB catalogue: reused **64** · **0** Primary mappings
- Staff profiles: **26** unchanged

## Schema / code

| Path | Change |
| --- | --- |
| `supabase/migrations/024_gta_programme_sessions.sql` | `gta_programme_sessions` + task `source_pdf` / `evidence_ref` / `curriculum_purposes` |
| `src/features/programme-definition/domain/types.ts` | Optional control fields on programme parameters |
| `src/features/programme-definition/domain/rpl-formulas/programme-parameters.ts` | Zod optional control fields |

## Seed / fixture

| Path | Role |
| --- | --- |
| `data/curriculum-control/autocare-st0499-v1.3-phase1-fixture.json` | SOW-parsed Phase 1 fixture (113 sessions, 50 tasks) |
| `scripts/build-autocare-phase1-fixture.py` | Rebuild fixture from SOW extract |
| `scripts/seed-autocare-phase1-controlled.mjs` | Guarded idempotent seed |
| `scripts/apply-one-migration.mjs` | Apply single migration |
| `scripts/verify-autocare-phase1.mjs` | Post-seed verify |

## Intentionally NULL / not done

- resource → session bindings  
- KSB Primaries / typed KSB curriculum graph  
- Learning objective rows  
- Golden B / HOLDs / ERs  
- Learner records / Other Portal  

## Conflicts vs SOW / H1–H9

None in seeded spine/session counts. Fixture parse flags: **none** (113/113).

## Visual

Cursor canvas: `autocare-phase1-structure`  
Open Programme Builder: `/management/programme-builder` (same Supabase project).

## Phase 2 (not started)

1. Session browser UI in Programme Builder  
2. Course Builder surfaces showing controlled forms/PDFs  
3. Controlled teaching-material attachments (nullable week)  
4. Controlled KSB relationships from ratification pack (not auto Golden B)
