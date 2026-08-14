# Programme Builder authoring security hardening

Security / permissions pass only. No curriculum change. Block 3 not started.

## Permission model (existing — no new role)

Authoring APIs require **both**:

- `management.workspace.view`
- `management.programme.setup`

Tutors keep `modules.deliver` for delivery only.

## Invariants after pass (unchanged)

| Check | Before | After |
|---|---|---|
| OTJ | 611.5 | 611.5 |
| Sessions | 113 | 113 |
| Tasks | 50 | 50 |
| Primaries | 0 | 0 |
| Real staff | 26 | 26 |
| Profiles | 28 | 28 |
| SAFE TEST apprentice | 1 | 1 |
| SAFE TEST tutor | 1 | 1 |
| SessionDeliveryRecords | 2 | 2 |
| S4 unlocks | 0 | 0 |
| Block 1 | unchanged | unchanged |
| Block 2 learner copy | approved_published | approved_published |
| Block 3 | draft / empty | draft / empty |
| Golden B | absent | absent |

## W011 SAFE TEST resource

Still present (`test_learner_resource_w011_visibility`). Keep until a genuine W011 learner resource exists or the three-role tests are retired.

## SAFE TEST tutor password

Do **not** re-run `seed-autocare-safe-test-tutor.mjs` to rotate — it upserts the profile.

Safest rotation (after manual validation, not done in this pass):

`supabase.auth.admin.updateUserById(d7f99919-c254-484a-9027-943480ad9a59, { password })`

Password only. No role / workspace / permission change. Then update `.tmp/safe-test-tutor-credentials.json`.

## Block 3

Not started. This pass clears the **authoring security gate** only.
