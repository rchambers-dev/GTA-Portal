# Kanban virtualisation strategy

## Requirements (approved)

- Year 1 / 2 / 3 navigation (weeks 1–52, 53–104, 105–156)
- 156 weekly positions + Pre-start + workflow states + pinned Overdue
- Multiple apprentices per week
- Windowed or virtualised rendering
- Exact programme-overdue duration
- Filters and view state in the URL

## Rendering model

Do **not** mount 156 DOM columns at once.

1. **Year tabs** select the active 52-week band.
2. **Window** selects a contiguous subset (default `span=6`, optional 13).
3. **Column virtualisation** — only columns in (or near) the window are mounted; optional overscan of ±1–2 weeks.
4. **Card virtualisation** — within a column, virtualise when learner count exceeds a threshold (e.g. 12); show first N + “+N more” drawer otherwise for Stage 4 simplicity.
5. **Overdue column** — always mounted, pinned to the right of the board viewport (not part of the week virtualiser).

## Placement rules

| Board position | Derived from |
|----------------|--------------|
| Pre-start | Status / start date in future |
| Week *n* | Calculated programme week from start date (and BiL rules when defined) |
| Gateway / EPA / Completed | Explicit programme status (manual workflow, not drag-by-week) |
| Overdue column | Past original/planned end and not completed |

Staff must **not** drag cards between week columns to represent elapsed time. Drag (if ever added) is limited to authorised workflow transitions.

## Programme overdue vs task overdue

- **Overdue column:** programme end passed without completion; card shows exact duration (days / weeks / months).
- **Task/review/evidence overdue:** badges on the card in the learner’s current week column — not relocation to Overdue.

## Data loading

```text
GET board(filters, year, from, span)
  → metricCounts
  → learnersInWindow[]   // only weeks from..from+span-1
  → overdueLearners[]
  → columnCounts for year (optional lightweight)
```

Server-side filtering via data-access port. Stage 2 uses fictional in-memory adapter returning the same shape.

## URL sync

`?year=1&from=1&span=6&mine=1&metric=missing_evidence&programme=…`

Restoring URL restores board position after opening a learner.

## Performance targets

- Dashboard shell visible ≤ 2s on typical office connection
- Board interactions ≤ 200ms after data loaded
- Seed target for stress later: hundreds of apprentices across 156 weeks

## Stage 2 shell behaviour

Stage 2 shows static/fictional columns and cards for layout approval only. Virtualisation libraries are introduced in Stage 4; Stage 2 must not hard-code a six-week-only architecture.
