# Programme definition (Programme Builder)

## Architecture ownership

> Skills England owns the official KSB set; GTA owns the delivery spine and pedagogic mapping; Primary owns valuation uniqueness; LearningIntent owns educational progression; Curriculum Validation advises quality; staff remain final authority.

Use that statement as a test for future features: if a proposal violates an ownership boundary, it is probably in the wrong layer.

### Operational principle (critical)

> **FIRST VERSION = expensive full review once.**  
> **FUTURE VERSIONS = maintain by exception** (copy-forward + delta/impact analysis + exception-only human review).

Jon must **not** re-review all 64 KSBs every time a new GTA Programme Version or Skills England official version appears. This is a first-class product rule for AI analysis, versioning, DB provenance, and Programme Builder UX — not a later bolt-on.

---

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

Historical published/locked versions remain **frozen**. Forks never mutate the source version.

Validation contexts: `draft` | `publish` | `lock`. Missing primary is a soft warning in draft and a publish/lock blocker. Multi-primary is always an error. Curriculum quality rules are advisory in every context.

---

## Product flow (day-to-day)

1. Load official Skills England occupation + apprenticeship product (locked snapshot)
2. Build the GTA programme spine in **Spine Builder** (blocks / gateways / EPA)
3. Assign official KSBs to **blocks only** — each mapping has a **LearningIntent** and at most one **Primary** block per KSB (required before publish)
4. **ASSESS** means checked/evidenced in that teaching block — not formal exam ownership
5. Drafts **auto-save** to Supabase (localStorage `gta.programmeDefinition.v5` is a cache); **Publish** when ready
6. Curriculum quality warnings via `curriculum-validation.ts` — never block publish
7. Coverage / Gap panel shows official requirement vs DB truth vs reviewed gaps vs proposed amendments

Course Builder remains the layer for task forms / task-level KSBs.

---

## Embedded AI curriculum-mapping architecture

### Target versioning model

```
V1  BASELINE (full exercise once)
    → AI / evidence curriculum analysis
    → human review
    → approved Primary / Reinforcement mappings
    → accepted gap decisions / statuses
    → published trusted baseline

V2+ MAINTAIN BY EXCEPTION
    → copy forward approved baseline (where still valid)
    → official diff + curriculum/source diff
    → AI re-analyses only impacted / new / changed / ambiguous
    → human reviews exceptions only
    → validate → publish
```

### Autocare golden baseline (prototype for V1)

Current Autocare rebuild (`231a8a32-…`, ST0499 v1.3) is the prototype **V1 baseline exercise**:

| Layer | Meaning |
|--------|---------|
| Official requirement | 64 Skills England KSBs |
| Current programme truth | Human-approved Primaries persisted in DB |
| Reviewed curriculum gaps | Human-confirmed SOW gaps (14 KSBs / 9 groups) |
| Proposed amendments | Advisory only — never count as coverage until approved + persisted |
| Not yet resolved | Official KSBs without Primary that are not confirmed gaps |

Once Jon completes and approves this baseline, future Autocare versions use **copy-forward + diff + impact analysis + exception review** — not another full 64-KSB remapping.

### A. Copy-forward rule

When creating a new GTA Programme Version from an **approved** previous version:

**Copy forward where still valid:**

- approved Primary mappings
- approved Reinforcement mappings
- `curriculumValue` values
- human decisions / gap decisions / statuses
- Course Builder content (where task↔block identity still resolves)
- formula / finance configuration
- programme metadata / config

**Rules:**

- Historical source version remains frozen
- Do **not** silently reinterpret unchanged approved mappings
- AI must **not** redo all mappings from zero or override prior human decisions solely because confidence differs
- Copy creates **new mapping rows** on the target version with provenance links back to source rows (see G)

`createNextProgrammeVersion` today copies spine/mappings/params for same-official forks — it must grow provenance + impact classification. Blank-spine-only creation remains for true first-time programmes with no approved baseline.

### B. Detecting changed official KSBs

Compare bound `OfficialStandardVersion` (immutable snapshots):

| Signal | Example |
|--------|---------|
| New KSB | Code appears only on new official |
| Removed KSB | Code missing on new official |
| Changed wording | Same code, statement/hash differs |
| Type change | K↔S↔B |
| Duty changes | Duty list / titles / statements |
| KSB↔Duty relationship changes | Link added/removed/moved |

Output feeds impact classes **NEW**, **REMOVED**, **IMPACTED** (official).

### C. Detecting changed curriculum evidence

Compare GTA curriculum artifacts between source and target:

- lesson / session content (SOW / lesson-plan pack versions)
- added / removed sessions
- moved blocks / changed spine structure
- changed teaching evidence (aims, activities, assessment)
- changed Course Builder tasks

A source-document version change must be able to trigger impact analysis even when the official standard is unchanged.

### D. What triggers AI reassessment

| Trigger | AI action |
|---------|-----------|
| Official KSB wording/type/duty-link change for a mapped code | Reassess that KSB |
| Curriculum evidence change on a block/session that hosts a mapping | Reassess mapped KSBs for that evidence |
| New KSB | Fresh Primary (and optional Reinforcement) proposal |
| Removed KSB | Retire mapping; no reintroduce |
| Orphaned block/content reference | Flag ORPHANED |
| Unchanged official + unchanged evidence | **Preserve** previous human decision — no remap |

AI uses the previous human-approved version as a **trusted baseline**, not a weak prior.

### E. What is preserved automatically

Classification on the new draft:

| Class | Meaning | Human? |
|-------|---------|--------|
| **UNCHANGED / CARRIED FORWARD** | Still valid | No re-review |
| **IMPACTED** | Official or curriculum evidence changed enough to reassess | Yes |
| **NEW** | New KSB or new content needing a first decision | Yes |
| **REMOVED** | Official KSB gone | Confirm retirement |
| **ORPHANED** | Mapping points at missing KSB/block/content | Yes |
| **AMBIGUOUS** | AI cannot safely keep prior decision | Yes |

Unchanged mappings + values + gap decisions copy automatically with provenance.

### F. Human review limited to impacted items

Programme Builder **Version impact review** (target UX):

```
Version impact review

58 mappings unchanged → carried forward automatically
3 official KSBs changed → review required
2 curriculum changes affect existing mappings → review required
1 new KSB → Primary required
1 old KSB removed → previous mapping retired

Review required: 7 items
```

Jon reviews those 7 only — not all 64.

Coverage / Gap panel remains the ongoing audit surface; impact review is the **delta workflow** after fork / official retarget.

### G. Required DB / provenance fields

Design (target schema — not implemented yet):

**On each copied/reassessed mapping (or companion decision row):**

| Field | Purpose |
|-------|---------|
| `sourceProgrammeVersionId` | Baseline / prior version |
| `targetProgrammeVersionId` | New draft version |
| `previousMappingId` | Row on source version |
| `copiedFromMappingId` | Immediate parent copy |
| `previousHumanDecision` | Approved Primary / Reinforcement / gap status |
| `impactClass` | UNCHANGED \| IMPACTED \| NEW \| REMOVED \| ORPHANED \| AMBIGUOUS |
| `impactReason` | Why reassessed or carried |
| `aiReassessment` | Optional AI suggestion for impacted/new only |
| `newHumanDecision` | Outcome on target |
| `decisionTimestamp` | When decided |
| `decisionActor` | Who decided |

Explainability examples:

- *"Approved by Jon in V1 and copied unchanged into V2 because neither the official KSB nor the teaching evidence changed."*
- *"Required re-review because Skills England changed K18 and the ADAS lesson also changed."*

**Document version registry (analysis inputs):**

| Artifact | Track |
|----------|--------|
| Official standard version | `standardVersionId` + external version + content hash |
| GTA programme version | `programmeVersionId` + internal version |
| SOW / Clean Master / lesson-plan pack | document id + version + content hash |
| AI analysis run | run id, feature key, model, prompt version, timestamp |
| Impact report | run id → classification set |

### H. Programme Builder impact-review UX

1. After fork / `forkProgrammeOntoOfficialVersion`, open **Version impact review** before unrestricted remap
2. Summary counts by impact class
3. Exception queue only (IMPACTED / NEW / ORPHANED / AMBIGUOUS / REMOVED confirmations)
4. Carry-forward list collapsible (audit), not a full re-approval grid
5. Publish remains blocked until Primary coverage rules satisfied for the **new** official KSB set
6. Coverage / Gap panel continues to distinguish Approved / Reviewed gap / Proposed / Not yet resolved

### I. Historical versions remain frozen

- Published / locked / superseded versions are immutable for structure, mappings, values, formula, tasks pin
- Learners stay on enrolment-pinned programme version
- Forks allocate new version ids; copy with provenance — never rewrite history
- Source-document packs used for a baseline analysis remain referenced by version/hash

### J. Interaction with official-version fork

Approved backlog API (design):

```ts
forkProgrammeOntoOfficialVersion({
  sourceProgrammeVersionId,
  targetOfficialStandardVersionId,
})
```

**Flow:**

1. Import new Skills England official version (immutable)
2. Fork previous GTA programme onto that official version
3. Copy previous approved programme state (mappings, values, gaps, config, eligible course content)
4. Run **official-version diff**
5. Run **curriculum / source-document diff** (may be empty if GTA curriculum unchanged)
6. Generate **impact report**
7. AI re-analyses impacted/new/ambiguous only
8. Jon reviews exceptions
9. Validate → publish V2
10. Previous published programme + learners unchanged

### Same official version / GTA internal revision

Also supported:

```
Official SE v1.3 (unchanged)
GTA Programme V1 → GTA Programme V2
```

- Official KSB set = unchanged
- Mappings copy forward
- Only curriculum / spine / lesson / task diffs trigger reassessment
- Example: B5 lesson content changes → reassess KSBs whose evidence depended on that content; do **not** re-review unrelated B2/B3/B6 mappings

---

## AI behaviour rules (summary)

| Must | Must not |
|------|----------|
| Treat approved baseline as trusted | Remap all KSBs from zero on every version |
| Reassess only on meaningful change | Override human decisions on confidence alone |
| Preserve unchanged Primaries / Reinforcements / values / gap statuses | Count proposed amendments as coverage |
| Limit human UX to exceptions | Force full 64-item re-approval for V2+ |
| Record provenance for every copy/reassessment | Mutate historical versions |

Existing AI entry point today: `programme.recommend_ksb_intent` (LearningIntent suggestion).

### AI-1 implemented (recommendations only)

- Feature: `programme.baseline_curriculum_analysis`
- Tables: `gta_curriculum_analysis_runs`, `gta_curriculum_analysis_results`
- Evidence: current-approved original corpus under `data/curriculum-evidence/` (proposed amendments excluded)
- UI: inspect-only AI Analysis panel inside Curriculum Coverage / Gap
- Eval: `npm run eval:autocare-v1-curriculum-ai` (heuristic) / `:portal` (live model)
- AI results never count as approved coverage and never auto-persist mappings

Baseline + delta analysis for V2+ remains a later feature (`programme.version_impact_analysis`) — design only.

---

## Recommended implementation phases

### Phase 0 — Finish Autocare V1 golden baseline (current workstream)

- Complete human Primary + gap decisions for remaining KSBs
- Persist only human-approved Primaries
- Keep proposed amendments advisory
- Coverage / Gap panel reflects DB truth
- **No full remap automation yet**

### Phase 1 — Provenance + copy-forward correctness

- Schema for mapping / decision provenance fields
- Fork allocates remapped spine/mapping ids safely with `copiedFromMappingId`
- Gap decisions stored as versioned data (not only UI constants)
- Document version registry stubs (programme + official + SOW hashes)

### Phase 2 — Diff engines (no UX yet)

- Official snapshot diff (codes, wording hash, type, duties, links)
- Curriculum/source diff (spine structure, session/content hashes, course tasks)
- Impact classifier → UNCHANGED / IMPACTED / NEW / REMOVED / ORPHANED / AMBIGUOUS

### Phase 3 — Impact review UX

- Version impact review panel (exception queue)
- Carry-forward automatic; review required list only
- Wire publish gate to new official KSB set coverage

### Phase 4 — AI exception analysis

- Register AI features for baseline (V1 only) and impact reassess (V2+)
- AI consumes prior human decision + change evidence; proposes only for exceptions
- Never auto-persist; staff remain final authority

### Phase 5 — `forkProgrammeOntoOfficialVersion`

- End-to-end official retarget workflow
- Enrolment pin / RPL dimensions remain bound to historical versions
- `availableRplDimensions` derived from bound official KSB types (already design-approved)

### Phase 6 — Hardening

- Audit trail export (“why was this mapping kept?”)
- Tests for classifier + copy-forward immutability
- Performance on large pack diffs

---

## Open

`/management/programme-builder`

**Load / Open** an apprenticeship:

1. If already in the portal database (`se_*` tables) → return that locked version (no duplicate)
2. If not → fetch from Skills England, save once, then open it
3. On failure → show an error (no silent offline / fixture fallback)
4. Prefer opening an **explicit DB programme version** (no silent newest fallback when multiple exist)
5. **Back** returns to the catalogue; the draft stays saved

Needs `SKILLS_ENGLAND_API_KEY` only when the apprenticeship is not already in the database.

## Storage note

Official versions persist in Supabase after first import. Programme spines and Block↔KSB mappings (`gta_spines` / `gta_spine_items` / `gta_spine_item_ksbs`) are the source of truth; the browser caches in `localStorage` (`gta.programmeDefinition.v5`). DB wins on hydrate.

Recommendation provenance (`recommendation_provider`, `recommended_intent`, …) is stored separately from `mapping_source` so overrides still retain what was suggested.

**History & API log** is shared in Supabase (`gta_programme_activity`).

Generated SOW / RPL documents must always cite `programmeVersionId` + `internalVersion`.
