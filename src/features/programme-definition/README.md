# Programme definition (Programme Builder)

## Architecture ownership

> Skills England owns the official KSB set; GTA owns the delivery spine and pedagogic mapping; Primary owns valuation uniqueness; LearningIntent owns educational progression; Curriculum Validation advises quality; staff remain final authority.

Use that statement as a test for future features: if a proposal violates an ownership boundary, it is probably in the wrong layer.

## Lifecycle

```
Programme
 └── Version N
      draft → published → locked | superseded
```

| State | Allowed |
|--------|---------|
| **Draft** | Edit spine, mappings, primaries, OTJ hours, formula freely |
| **Published** | In-place: wording/metadata only (title, RPL notes). Material changes (spine, mappings, primary, OTJ hours, formula) create **Version N+1** |
| **Locked** | Learners enrolled — curriculum immutable |

Validation contexts: `draft` | `publish` | `lock`. Missing primary is a soft warning in draft and a publish/lock blocker. Multi-primary is always an error. Curriculum quality rules are advisory in every context.

## Product flow

1. Load official Skills England occupation + apprenticeship product (locked snapshot)
2. Build the GTA programme spine in **Spine Builder** (blocks / gateways / EPA)
3. Assign official KSBs to **blocks only** — each mapping has a **LearningIntent** and at most one **Primary** block per KSB (required before publish)
4. **ASSESS** means checked/evidenced in that teaching block — not formal exam ownership
5. Drafts **auto-save** to Supabase (localStorage `gta.programmeDefinition.v5` is a cache); **Publish** when ready
6. Curriculum quality warnings via `curriculum-validation.ts` — never block publish
7. Enabled RPL formula weights must sum to **1.0** (no silent renormalisation)

Course Builder remains the layer for task forms / task-level KSBs.

New programme versions start with a **blank spine**. Nothing is pre-filled.

## Open

`/management/programme-builder`

**Load / Open** an apprenticeship:

1. If already in the portal database (`se_*` tables) → return that locked version (no duplicate)
2. If not → fetch from Skills England (Maps + open ST JSON), save once, then open it
3. On failure → show an error (no silent offline / fixture fallback)
4. Reopening prefers the existing GTA draft for that standard
5. **Back** returns to the catalogue; the draft stays saved

Needs `SKILLS_ENGLAND_API_KEY` only when the apprenticeship is not already in the database.

## Storage note

Official versions persist in Supabase after first import. Programme spines and Block↔KSB mappings (`gta_spines` / `gta_spine_items` / `gta_spine_item_ksbs`) are the source of truth; the browser caches in `localStorage` (`gta.programmeDefinition.v5`). Upgrading from `v2`–`v4` migrates legacy `assignedKsbCodes` into mappings.

Recommendation provenance (`recommendation_provider`, `recommended_intent`, …) is stored separately from `mapping_source` so overrides still retain what was suggested.

**History & API log** is shared in Supabase (`gta_programme_activity`) so every staff member sees the same timeline. Primary moves are logged explicitly (e.g. `K12 primary moved Block 2 → Block 5`).

Generated SOW / RPL documents must always cite `programmeVersionId` + `internalVersion`.
