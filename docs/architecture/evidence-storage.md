# Evidence storage and versioning design

## Checklist source of truth

The shared learner **Evidence** tab displays **ADM14.0 Apprenticeship Evidence Pack Form (From August 2022) v2.1** — the complete file checklist each learner should hold or start completing.

Canonical definitions live in `src/features/learner-lifecycle/domain/adm14-checklist.ts` (sections 1–8, M/O). Further GTA paper forms will be mapped into this model as they are supplied.

## Goals (approved)

- Evidence always linked to a specific checklist requirement
- Immutable versions — never silently overwrite
- Received ≠ Checked
- Recurring requirements hold multiple records
- Every significant change → TimelineEvent + AuditEvent

## Controlled Add Evidence flow

1. Select requirement (section + reference, e.g. `1.4`)
2. Select evidence type (PDF, digital form, statement, observation, …)
3. Capture metadata (supplied by, dates, confidentiality, links)
4. Verification fields (status, checker, due, discrepancy notes)
5. Persist:
   - `EvidenceRecord` (stable id)
   - `EvidenceVersion` (immutable blob + metadata snapshot)
   - `EvidenceLink` → `LearnerRequirement`
   - update requirement status
   - optional verification `Task`
   - `TimelineEvent` + `AuditEvent`

## Versioning rules

| Action | Behaviour |
|--------|-----------|
| First upload | Version 1 |
| Correction / replacement file | New version; previous remains readable |
| Status change | Audit + timeline; does not mutate version bytes |
| Supersede | Mark prior version `superseded`; link new version |
| Delete | Soft-archive only; no silent hard delete in ordinary UI |

## Status model (initial)

`Future requirement` · `Not applicable` · `Missing` · `Requested` · `Received` · `Awaiting check` · `Checked and accepted` · `Checked with discrepancy` · `Correction required` · `Disputed` · `Due for review` · `Expired` · `Superseded` · `Archived`

**Not applicable** requires: reason, deciding user, timestamp (± supporting note).

## Recurring requirements

Model as collections under one `LearnerRequirement` (or child collection entity). Checklist row shows latest status + count + next due.

## File storage (adapter)

Port: `EvidenceStoragePort`

| Environment | Implementation |
|-------------|------------------|
| Stage 2 | No real uploads; UI shells only |
| Stage 3–6 local | Local filesystem under gitignored `uploads/` |
| Production | S3-compatible object storage + short-lived signed URLs |

Rules: MIME allow-list, size limits, no public permanent URLs, download audited where appropriate.

## Sign-off

Authenticated `StaffSignOff` records user, role, timestamp, action, evidence version, outcome. Formal e-signature only when the underlying agreement requires it (Q4).

## Intake integration (future)

Digital intake forms create evidence automatically — users must not complete a form and then separately “Add Evidence.” Stage 2 placeholders must not assume a single-file-only model or hard-coded field sets that block form-produced evidence.
