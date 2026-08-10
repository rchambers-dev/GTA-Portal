# Product / data-model learning (record only)

**NOT IMPLEMENTED.** Findings from the traceability pilot for later Programme Builder design.

## Entities the evidence requires

| Entity | Why needed |
|---|---|
| `CurriculumResource` | PPT/DOCX/PDF assets with hash, era, Group provenance |
| `LearningObjective` | Extractable aims from Group/Block LPs |
| `GroupSession` | Legacy Group lesson context |
| `BlockSession` | Current Block/week/session (week nullable) |
| `KsbRequirementComponent` | Partial coverage of multi-part KSBs |
| `PracticalTask` | Block Tasks 3–4 etc. |
| `PracticalAssessmentTask` | CEA + Gateway component assessments |
| `KnowledgeAssessment` | Initial assessments, GW practice papers, online stubs |
| `WorkplaceEvidence` | Job cards / e-logbook (often referenced only) |
| `GatewayAssessment` | GW1/GW2 practical + knowledge readiness layer |

## Typed relationships (required)

`ROUTING` · `TEACHES` · `PRACTISES` · `ASSESSES` · `KNOWLEDGE_CHECKS` · `RECORDS_EVIDENCE` · `REINFORCES` · `SUPPORTS` · `PREPARES_FOR_GATEWAY` · advisory `PRIMARY_TEACHING_CANDIDATE`

Every edge: `basis` + `confidence` (`EXPLICIT` … `UNRESOLVED`).

## Critical rules to encode

1. Group provenance is never deleted when Block links are added.  
2. Transition Guide is `ROUTING`, not automatic resource placement.  
3. Week must be nullable; Block-only links are first-class.  
4. A resource may link to many Blocks/KSBs/components.  
5. S10-style distributed graphs must not coerce a single owner.  
6. `REINFORCES` cannot promote `PRIMARY_TEACHING_CANDIDATE` automatically.  
7. Component-level coverage feeds future assurance scores (no whole-KSB greenwash).

## Longer-term Portal goal (unchanged)

Controlled authoring so the Portal knows why a resource exists, what it teaches, which KSB component it serves, where it is delivered, what task follows, how it is assessed, and what evidence demonstrates application — eventually generating consistent curriculum documents.
