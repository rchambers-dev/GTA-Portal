# Autocare Phase 2A — Block 1 Session Authoring Pilot

**Status:** Implemented · awaiting visual review  
**Date:** 2026-08-12  
**Programme version:** `e8e578d5-ec0d-4de7-b9e2-5f4fa480b662`  
**Control tag:** `autocare-st0499-v1.3-phase1-controlled`

**Not:** Phase 2B · learner sign-off · Task forms · Primaries · Golden B · Blocks 2–10 resource mapping · S7 release weeks

## What was implemented

1. Schema for programme resources + per-attachment role/audience (multi-session capable)  
2. Session `publish_status` (draft/published) + `learning_objectives_review` (candidate aims)  
3. Block authoring panel (Overview / Sessions / Materials / Tasks / Staff preview)  
4. Block 1 seed: FS01–FS10 lesson plans → W001–W010 as Tutor delivery / Tutor only  
5. Multi-session example: Foundation pack README on W001 and W010  
6. Unplaced Block 1 materials (Task 3/4 PDFs, SPR, LIR)  
7. S8 panel retained as technical QA scaffolding  

## Schema

| Migration | Change |
| --- | --- |
| `026_gta_programme_resources.sql` | `gta_programme_resources`, `gta_programme_resource_attachments`, session publish + LO review columns |

## Seed report (guards passed)

| Check | Value |
| --- | --- |
| FS lesson plan attachments | 10 |
| Multi-session README attachments | 2 (W001 + W010) |
| Unplaced | 4 |
| Sessions | **113** unchanged |
| Tasks | **50** unchanged |
| Primaries | **0** |
| Profiles | **26** unchanged |
| OTJ | **611.5** unchanged |

## FS mappings (evidence-backed)

| Session | FS | Evidence resource | Role / audience |
| --- | --- | --- | --- |
| W001 | FS01 | `res_lp_8f67680b4ed9` | Tutor delivery · Tutor only |
| W002 | FS02 | `res_lp_a1de2dadb565` | Tutor delivery · Tutor only |
| … | … | … | … |
| W010 | FS10 | `res_lp_76cd8f807cd7` | Tutor delivery · Tutor only |

Source: controlled catalogue v1.2 + SOW Foundation Skills sequence. Lesson plan binaries not required in git; extracts used for candidate aims.

## Deliberately unmapped / unplaced

| Resource | Why |
| --- | --- |
| Block 1 Task 3/4 PDFs | Block-scoped practicals; exact session not locked in 2A |
| Skills Progress Review | Supporting form; not a single SOW session |
| Learning Impact Record | Not controlled Task 5; retained unplaced |
| Learner PowerPoints / handouts | Not invented — none attached as learner-visible |
| Task↔session earliest links | S7 deferred |
| KSB typed session relationships | Out of scope |

## How to review in UI

1. Open Programme Builder → Autocare programme  
2. Click **Block 1** in the spine table  
3. Use **Sessions** tab → W001 / W002 detail  
4. Check tutor delivery vs empty learner materials  
5. **Materials** tab → Unplaced  
6. **Staff preview** → multi-session README demo  

## Recommended Phase 2B (not started)

- Repeat pattern for Block 2 with evidenced session materials only  
- Human approve candidate LOs → optional structured LO rows  
- Optional resource library browser for unplaced→session authoring  
- Still no learner sign-off / Golden B / Primaries unless separately authorised  
