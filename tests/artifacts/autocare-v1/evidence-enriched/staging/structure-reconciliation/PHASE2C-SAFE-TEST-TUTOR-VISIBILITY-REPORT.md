# Phase 2C — SAFE TEST tutor + W011 visibility chain

**Status:** Implemented 2026-08-13. Block 3 not started.

## Staff / tutor model (inspected, not redesigned)

| Actor | Workspace | Role | How they get Programme Delivery | How they get Programme Builder |
|---|---|---|---|---|
| Curriculum owner | `management` | Management | via `staff.workspace.view` on management accounts | `/management/*` needs `management.workspace.view` + `management.programme.setup` |
| Tutor | `staff` | Tutor | `/staff/programme-delivery` needs `modules.deliver` | No — route requires management workspace |

Live tutors use this pack (TEST tutor matches it exactly):

`messages.view`, `ai.use`, `staff.workspace.view`, `apprentices.assigned.view`, `apprentice.workspace.view`, `modules.deliver`, `lifecycle.kanban.view`

Tutors are **not** curriculum authors in the approved model.

## Created

- Tutor: `TEST Autocare Tutor (SAFE DEMO)` / `test-autocare-tutor@example.invalid` / workspace `staff` / role `Tutor` / status `active`
- Profiles: 27 → **28** (26 real `@doncastergta.co.uk` staff unchanged + 1 SAFE TEST apprentice + 1 SAFE TEST tutor)
- W011 resource: `TEST learner resource — W011 visibility proof — SAFE DEMO` · `LEARNER_LEARNING` · `LEARNER_VISIBLE`

## Cleanup later

Delete the W011 `LEARNER_VISIBLE` attachment for resource_key `test_learner_resource_w011_visibility`, then delete that resource row. Leave W011 `learner_facing_content`, v4.4 lesson plan, Tasks, and Sessions untouched.

## Permissions gaps (reported, not redesigned)

- Most `/api/management/programme-definition/*` routes still have no session check (UI is gated). Extract GET is now staff/tutor-only.
- Delivery bundle GET is now staff/tutor-only (was previously unauthenticated).
