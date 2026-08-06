# Programme definition (Programme Builder)

Management foundations for Jon:

1. Load official Skills England occupation + apprenticeship product (locked snapshot)
2. GTA programme spine (blocks / gateways / EPA)
3. Assign official KSBs to blocks
4. Validate coverage + structure hours vs minimum compliance hours

Course Builder remains the layer for task forms / task-level KSBs.

## Open

`/management/programme-builder`

**Load / Open** an apprenticeship:

1. If already in the portal database (`se_*` tables) → return that locked version (no duplicate)
2. If not → fetch from Skills England (Maps + open ST JSON), save once, then open it
3. On failure → show an error (no silent offline / fixture fallback)
4. Reopening the same Skills England version always returns the **same GTA draft** (never duplicates)
5. **Back** returns to the catalogue; the draft stays saved
6. Once apprentices are enrolled (or the version is published), structure/KSBs/hours lock; wording (titles) can still be edited

Needs `SKILLS_ENGLAND_API_KEY` only when the apprenticeship is not already in the database.

## Storage note

Official versions persist in Supabase after first import. Draft programme spines also cache in `localStorage` (`gta.programmeDefinition.v2`) for the browser until the GTA write-path is fully wired.
