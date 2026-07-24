# Entity-relationship proposal (Phase 1)

Stage 2 does **not** require a live database. This is the target relational model for Stage 3+.

## Principles

- Separate facts, statements, evidence, judgements, and decisions at the data layer where practical.
- Original planned end date is immutable; revisions live in `DateChangeHistory`.
- Evidence content is versioned; prior versions are never overwritten.
- Learner is linked to a `RequirementFramework` version (no silent retroactive requirement changes).
- Soft-delete / archive for regulated learner records; audit events are append-only.

## Core ERD (logical)

```text
User ──< UserRole >── Role ──< RolePermission >── Permission
User ──? Location

Employer ──< LearnerProgramme >── Programme ──< ProgrammeVersion
Learner ──< LearnerProgramme
User (staff) ──< StaffAssignment >── LearnerProgramme  (tutor | mentor)

RequirementFramework ──< RequirementSection ──< EvidenceRequirement
LearnerProgramme ── frameworkVersion
LearnerProgramme ──< LearnerRequirement >── EvidenceRequirement
LearnerRequirement ──< EvidenceLink >── EvidenceRecord ──< EvidenceVersion
StaffSignOff ──> EvidenceVersion / LearnerRequirement

LearnerProgramme ──< Task
LearnerProgramme ──< TimelineEvent
* ──< AuditEvent  (entityType + entityId)

LearnerProgramme ──< DateChangeHistory
LearnerProgramme ──< ProgrammeStatusHistory

# Stubs for Phase 1 fixtures / later UI
LearnerProgramme ──< Review
LearnerProgramme ──< Intervention
LearnerProgramme ──< Discrepancy
```

## Phase 1 entities (implement in Stage 3)

| Entity | Purpose |
|--------|---------|
| User, Role, Permission, UserRole, RolePermission | Identity & RBAC |
| Location | Optional site filter |
| Employer | Employer org |
| Programme, ProgrammeVersion | Programme catalogue |
| Learner | Master identity |
| LearnerProgramme | Enrolment + dates + status |
| StaffAssignment | Tutor/mentor links |
| RequirementFramework, RequirementSection, EvidenceRequirement | Configurable pack 1.1–8.1 |
| LearnerRequirement | Per-learner checklist row + status |
| EvidenceRecord, EvidenceVersion, EvidenceLink | Immutable versions + links |
| StaffSignOff | Authenticated check outcomes |
| Task | Shared action engine |
| TimelineEvent | Chronological learner history |
| AuditEvent | Append-only change log |
| DateChangeHistory, ProgrammeStatusHistory | Date/status integrity |
| Notification | Minimal alerts |
| Review, Intervention, Discrepancy | Stub tables for fixtures |

## Derived (do not store unless justified)

| Value | Source |
|-------|--------|
| Programme week | start date + calendar rules (± BiL TBD) |
| Programme overdue duration | now − original/planned end when status incomplete |
| KPI metric counts | Aggregations over LearnerProgramme + Task + LearnerRequirement |
| Card priority | Priority engine over tasks + statuses |

## Privacy classification (summary)

| Class | Examples | Card front? |
|-------|----------|-------------|
| Operational | programme, week, open actions | Yes |
| PII | name, contact | Name only as needed |
| Sensitive support | safeguarding, welfare detail | **Never** — display-safe summary only |
| Inspection | audit, judgements | Role-gated |

## Deletion / retention

- Prefer `archivedAt` / `deletedAt` over hard delete for learner and evidence.
- Audit and signed evidence versions: no ordinary-app edit or delete.
- Retention periods: see Q&D register (statutory periods unresolved).

## Intake readiness

Learner and LearnerProgramme fields that intake will populate later must allow null / “Awaiting intake” display. UI must never treat null as a positive RAG status.
