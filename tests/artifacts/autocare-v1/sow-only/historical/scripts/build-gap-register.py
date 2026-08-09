"""Record final gaps S23/S25; emit consolidated curriculum-gap register."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
dec = json.loads((OUT / ".tmp-primary-decisions.json").read_text(encoding="utf-8"))
audit = json.loads((OUT / ".tmp-unmapped-audit.json").read_text(encoding="utf-8"))
d = json.loads((OUT / ".tmp-step4-reclassified-mappings.json").read_text(encoding="utf-8"))
by = {i["ksbCode"]: i for i in audit["items"]}

batch_d = {
    "S23": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "Paired with K34. Needs explicit digital systems + GDPR + cyber teaching. No stock-security / generic emerging-tech substitute.",
        "likelyDesignAreas": ["B5", "B7", "B9", "B10"],
        "cluster": "digital_gdpr_cyber",
        "doNotAssignNearestBlock": True,
    },
    "S25": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "Paired with K20. Needs explicit check/replace fluids and filtration parts practical. No parts/catalogue/brake nearest-fit.",
        "likelyDesignAreas": ["B2", "B3", "B10"],
        "cluster": "fluids_filtration",
        "doNotAssignNearestBlock": True,
    },
}

for code, meta in batch_d.items():
    evidence = by.get(code, {})
    dec["curriculumGaps"][code] = {
        **meta,
        "type": evidence.get("type") or ("skill" if code.startswith("S") else "knowledge"),
        "description": evidence.get("description")
        or {
            "S23": "Use information and digital technology systems. Comply with GDPR and cyber security.",
            "S25": "Apply procedures to check and replace fluids, and filtration parts.",
        }[code],
        "evidenceSnapshot": {
            "verdict": evidence.get("verdict"),
            "why": evidence.get("why"),
            "focusHitsIncludedSample": (evidence.get("focusHitsIncluded") or [])[:5],
            "candidatesRejectedAsInsufficient": evidence.get("candidates") or [],
        },
        "publicationBlocker": True,
    }

dec["batches"].append(
    {
        "batch": "unmapped-D",
        "codes": list(batch_d.keys()),
        "status": "curriculum_gap_recorded",
        "approvals": batch_d,
    }
)

# Consolidated grouped register
GROUPS = [
    {
        "groupId": "edi_inclusive_workplace",
        "title": "Equity, diversity, inclusion & inclusive workplace",
        "ksbs": ["B5", "K31", "S20"],
        "missingTeaching": [
            "Explicit EDI principles and workplace impact (K31)",
            "Complying with EDI guidance in practice (S20)",
            "Supporting an inclusive workplace / respectful of different views (B5)",
        ],
        "likelyHostBlocks": [
            {"block": 2, "why": "Customer Interaction — natural early professional behaviours/customer context"},
            {"block": 3, "why": "Workshop Processes — already Primary home for several workplace behaviours/skills"},
            {"block": 10, "why": "Consolidation — can reinforce but usually weak as first Primary unless new dedicated session"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": True,
            "practicalActivity": True,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 3,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Align with approved workplace-behaviour Primaries (B1/B2/S1/S2/S3 → B3). Only valid once an explicit EDI session/activity exists.",
        },
    },
    {
        "groupId": "role_industry_autonomy",
        "title": "Industry context, technician role, autonomy & reporting",
        "ksbs": ["K1"],
        "missingTeaching": [
            "Automotive industry context",
            "Role of the autocare technician",
            "Limits of autonomy",
            "Reporting channels",
        ],
        "likelyHostBlocks": [
            {"block": 1, "why": "Foundation Skills / induction — logical home IF approved FS↔KSB crosswalk + explicit content are added"},
            {"block": 2, "why": "Early specialist block if B1 remains without coded KSB ownership"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": True,
            "practicalActivity": False,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 1,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Best pedagogical fit for induction/role context, but NOT defensible until Block 1 has explicit content and approved KSB mapping evidence.",
        },
    },
    {
        "groupId": "inspection_to_spec",
        "title": "Safety inspection & routine maintenance to manufacturer data/schedules",
        "ksbs": ["K2", "S7"],
        "missingTeaching": [
            "Manufacturer specifications / approved maintenance schedules (K2)",
            "Vehicle-specific data use and legal wear/serviceability requirements (K2)",
            "Apply safety inspection and routine maintenance procedures using vehicle-specific data (S7)",
        ],
        "likelyHostBlocks": [
            {"block": 2, "why": "Already hosts intake/inspection and service themes — strongest logical early host once content is explicit"},
            {"block": 3, "why": "Brake/tyre wear checks exist but currently lack schedule/spec/data teaching"},
            {"block": 10, "why": "Consolidation practice only after Primary teaching exists earlier"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": True,
            "practicalActivity": True,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 2,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Natural Primary for K2+S7 together once an explicit inspection-to-spec/data session is added (e.g. strengthen W16 or insert dedicated week).",
        },
    },
    {
        "groupId": "workplace_instructions",
        "title": "Workplace instructions (purpose and use)",
        "ksbs": ["K7"],
        "missingTeaching": [
            "What workplace instructions are",
            "Purpose and use for inspection, maintenance and replacement",
            "Applying instructions as a taught object of learning (not assumed)",
        ],
        "likelyHostBlocks": [
            {"block": 2, "why": "Intake/inspection workflow"},
            {"block": 3, "why": "Workshop procedures/documentation already present"},
            {"block": 5, "why": "Process discipline / record quality weeks"},
        ],
        "needs": {
            "newSession": False,
            "amendExistingSession": True,
            "practicalActivity": True,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 3,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "W26 workshop procedures/documentation is the best amendment target; Primary only after explicit 'workplace instructions' learning objectives/evidence exist.",
        },
    },
    {
        "groupId": "emissions_systems",
        "title": "Emission control systems knowledge",
        "ksbs": ["K13"],
        "missingTeaching": [
            "Purpose/function/location of emission control systems",
            "Catalytic converters, evaporative controls, EGR, DPF, PPF, SCR",
        ],
        "likelyHostBlocks": [
            {"block": 2, "why": "Systems inspection progression"},
            {"block": 5, "why": "Complex repair/diagnostic context"},
            {"block": 10, "why": "Consolidation/EPA systems practice — weak as sole Primary"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": False,
            "practicalActivity": True,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 5,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Best diagnostic/systems home once a dedicated emissions session is added; do not use current suspension/inspection proximity.",
        },
    },
    {
        "groupId": "fluids_filtration",
        "title": "Fluids & filtration (knowledge + skill)",
        "ksbs": ["K20", "S25"],
        "missingTeaching": [
            "Fluid and filtration systems: brake fluid, oil/oil filters, air filters (K20)",
            "Check and replace fluids and filtration parts (S25)",
        ],
        "likelyHostBlocks": [
            {"block": 2, "why": "Service/inspection pathway — logical practical home"},
            {"block": 3, "why": "Foundation workshop practice"},
            {"block": 10, "why": "Consolidation only after Primary teaching exists"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": True,
            "practicalActivity": True,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 2,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Co-locate K20+S25 in an early service block with an explicit fluids/filters practical; not brake-diagnostics by association.",
        },
    },
    {
        "groupId": "digital_gdpr_cyber",
        "title": "Information & digital technology / GDPR / cyber",
        "ksbs": ["K34", "S23"],
        "missingTeaching": [
            "Digital technology systems: email, collaboration, databases, MIS, POS, equipment interfaces (K34)",
            "GDPR and cyber security (K34/S23)",
            "Use information and digital technology systems in practice (S23)",
        ],
        "likelyHostBlocks": [
            {"block": 5, "why": "VIN/technical data / process-digital touchpoints"},
            {"block": 7, "why": "Advanced workshop practice — if digital job systems are taught explicitly"},
            {"block": 9, "why": "Emerging tech block — only if digital/GDPR content is added (not stock-security)"},
            {"block": 10, "why": "Portfolio/EPA digital evidence practices"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": True,
            "practicalActivity": True,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 5,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Best early data/systems fit once explicit GDPR/cyber/digital session exists; stock-security must never be used as evidence.",
        },
    },
    {
        "groupId": "adas_autonomy_levels",
        "title": "ADAS levels of autonomy (passive/active)",
        "ksbs": ["K18"],
        "missingTeaching": [
            "ADAS levels of autonomy",
            "Passive vs active advanced driver assistance systems",
        ],
        "likelyHostBlocks": [
            {"block": 9, "why": "Emerging technologies / pre-calibration adjacency (W89 teaches pre-checks, not autonomy levels)"},
            {"block": 10, "why": "Consolidation only after Primary teaching is added"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": True,
            "practicalActivity": False,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 9,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Extend emerging-tech/ADAS strand with an explicit autonomy-levels session (W89/W90 amendment or new week). Current pre-calibration content is insufficient alone.",
        },
    },
    {
        "groupId": "hv_battery_soh",
        "title": "HV battery / charger state-of-health testing",
        "ksbs": ["S11"],
        "missingTeaching": [
            "State-of-health condition monitoring tests on high voltage batteries",
            "SoH / condition monitoring of onboard chargers",
            "Explicit practical activity (not generic EV awareness/safety)",
        ],
        "likelyHostBlocks": [
            {"block": 6, "why": "Already Primary for K21/K23/S13 EV service/safety — best host if SoH practical is added"},
            {"block": 9, "why": "EV specialty block — alternative if SoH practical is placed in emerging-tech pathway"},
        ],
        "needs": {
            "newSession": True,
            "amendExistingSession": True,
            "practicalActivity": True,
            "assessmentEvidence": True,
        },
        "proposedPrimaryAfterAmendment": {
            "block": 6,
            "status": "PROVISIONAL_AFTER_AMENDMENT_ONLY",
            "rationale": "Keep with approved EV Primary cluster (K21/K23/S13 → B6) once a real SoH testing activity is added to W54 or a new adjacent week.",
        },
    },
]

# Validate all 14 gaps are present
gap_codes = sorted(dec["curriculumGaps"].keys(), key=lambda c: (c[0], int(c[1:])))
grouped_codes = sorted({c for g in GROUPS for c in g["ksbs"]}, key=lambda c: (c[0], int(c[1:])))

register = {
    "title": "Autocare v1.3 curriculum-gap register (publication blockers)",
    "rule": "Every official KSB → exactly 1 defensible Primary training block before programme publication",
    "status": "PUBLICATION BLOCKED — 14 required KSBs have no defensible Primary yet",
    "counts": {
        "officialCatalogue": 64,
        "humanApprovedPrimaries": len(dec.get("approvedPrimaries", {})),
        "curriculumGaps": len(gap_codes),
        "gapCodes": gap_codes,
        "groupedCodes": grouped_codes,
        "allGapsCoveredInRegister": gap_codes == grouped_codes,
    },
    "humanApprovedPrimariesSoFar": dec.get("approvedPrimaries", {}),
    "groups": GROUPS,
    "publicationGate": {
        "blocked": True,
        "mustResolveBeforePublish": gap_codes,
        "nextDecisionSteps": [
            "For each gap group, choose host block(s)",
            "Specify new session vs amend existing vs practical/assessment artefacts",
            "Amend SOW with explicit teaching evidence",
            "Then set exactly one Primary per KSB and optional Reinforcement",
            "Only then persist Block↔KSB mappings and later curriculumValue",
        ],
    },
}

dec["curriculumGapRegister"] = register
d["totals"]["curriculumGaps"] = dec["curriculumGaps"]
d["totals"]["curriculumGapCount"] = len(gap_codes)
d["totals"]["curriculumGapRegister"] = {
    "groupCount": len(GROUPS),
    "gapCount": len(gap_codes),
    "publicationBlocked": True,
}

(OUT / ".tmp-primary-decisions.json").write_text(
    json.dumps(dec, indent=2, ensure_ascii=False), encoding="utf-8"
)
(OUT / ".tmp-step4-reclassified-mappings.json").write_text(
    json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8"
)
(OUT / ".tmp-curriculum-gap-register.json").write_text(
    json.dumps(register, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(json.dumps({"gapCount": len(gap_codes), "groups": len(GROUPS), "covered": gap_codes == grouped_codes, "gaps": gap_codes}, indent=2))
