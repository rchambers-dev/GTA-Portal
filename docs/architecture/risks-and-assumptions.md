# Risks and assumptions

## Assumptions

| ID | Assumption | Mitigation |
|----|------------|------------|
| A1 | 156 weeks covers longest programme | Configurable max week; confirm Q1 |
| A2 | Website tokens remain the brand source of truth | Re-sync tokens if Website updates |
| A3 | Portal integration will provide session + data adapters | Ports defined now; no feature→Prisma imports |
| A4 | M/O ≈ Mandatory / Conditional | Label UI carefully; confirm Q3 |
| A5 | Programme week calculable from start date for Phase 1 | BiL rules deferred (Q17) |
| A6 | Fictional fixture names only | Never commit real learner PII |
| A7 | Standalone auth is placeholder until portal Auth.js | Same `AuthPort` shape |
| A8 | Incomplete intake fields may be null | Honest empty states; never fake RAG |

## Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | OneDrive sync locks `node_modules` / git | Medium | Prefer local clone or exclude sync folders |
| R2 | Divergence from Website tokens during standalone work | Low | Document token sync; visual QA before integrate |
| R3 | Feature accidentally couples to shell | High | Lint/convention: no shell imports from feature |
| R4 | Hard-coded Kanban window prevents 156-week model | High | Types + URL params support full range from Stage 2 |
| R5 | Premature Prisma schema blocks intake fields | Medium | Nullable intake fields; framework versioning |
| R6 | Double portal UX if Website `/portal` evolves separately | Medium | Integration plan after Stage 8 approval |
| R7 | Evidence MIME/storage security gaps before prod | High | Storage port + validation before real uploads |
| R8 | Performance with hundreds of learners | Medium | Virtualisation from Stage 4; load windowed data |

## Non-goals (Stage 2)

- Live database or Auth.js sessions
- Real file uploads
- Full Kanban virtualisation
- Digitising intake forms
- Modifying the main Website/portal
