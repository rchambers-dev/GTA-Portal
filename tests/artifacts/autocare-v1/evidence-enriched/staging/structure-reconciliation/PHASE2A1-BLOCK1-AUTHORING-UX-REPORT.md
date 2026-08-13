# Autocare Phase 2A.1 — Block 1 authoring UX refinement

**Status:** Implemented · awaiting visual confirmation  
**Date:** 2026-08-12  
**Not:** Phase 2B · sign-off · Primaries · Golden B · Blocks 2–10 remaps

## Changes

1. Overview journey copy + **View sessions** primary CTA  
2. Authoring status: **Draft** / **Ready for delivery** (not delivery complete)  
3. Candidate aims banner + heading (not “Learning objectives”)  
4. **View source / open lesson plan** → extract viewer (binary not faked)  
5. Materials authoring: attach / remove / place unplaced / role / audience / sort  
6. Activity / practice section + candidate activity from extract  
7. Task checkpoint orientation wording  
8. Authoring preview reframed  
9. S8 demoted behind **Advanced / QA tools**  

## Files / API

| Path | Change |
| --- | --- |
| `BlockAuthoringPanel.tsx` | Full UX refinement |
| `ProgrammeBuilderScreen.tsx` | Advanced/QA collapse for S8 |
| `resources/route.ts` | POST place_unplaced · DELETE attachment |
| `resources/extract/route.ts` | Source extract + candidate activities |
| `resource-extract.ts` | Extract load + activity heuristic |
| `programme-resources-repository.ts` | delete + place helpers |

## Guards

26 profiles · 611.5 OTJ · 113 sessions · 50 tasks · 0 Primaries · 4 unplaced retained · FS01–FS10 mappings unchanged

## Ready for Phase 2B?

**Yes — authoring clarity gate is met.** Phase 2B (tutor delivery + session sign-off) may start when separately authorised. Do not start automatically.
