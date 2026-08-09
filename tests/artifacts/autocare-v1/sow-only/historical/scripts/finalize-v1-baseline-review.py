#!/usr/bin/env python3
"""Final REVIEW_ONLY baseline close-out after K8/K6/K25 decisions + content re-check."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(r"D:\GTA Portal")
PRIOR = json.loads((ROOT / ".tmp-autocare-v1-ai-baseline-analysis.json").read_text(encoding="utf-8"))
VERIFY = json.loads((ROOT / ".tmp-v1-unresolved-verify.json").read_text(encoding="utf-8"))
DEFS = VERIFY["definitions"]

BLOCK_TITLES = {
    1: "Motor Vehicle Foundation Skills - Shared Controlled Programme",
    2: "Vehicle Inspection, Servicing and Customer Interaction",
    3: "Workshop Processes, Tools and Environmental Awareness",
    4: "Emerging Technology and Driveline Systems",
    5: "Diagnostic Thinking and Complex Repair Activities",
    6: "Vehicle Systems Integration and Advanced Diagnostics",
    7: "Advanced Workshop Practice and Technical Communication",
    8: "Advanced Diagnostics and Workshop Organisation",
    9: "Emerging Technologies, Electric Vehicles and Hydrogen Awareness",
    10: "Final Consolidation, Corrective Learning and EPA Readiness Training",
}

EXISTING_APPROVED = {
    "K12": 2, "K24": 2, "S12": 2, "S15": 2,
    "K29": 3, "K30": 3, "S1": 3, "S2": 3, "S3": 3, "S19": 3,
    "S4": 4,
    "K21": 6, "K23": 6, "S13": 6, "S14": 6,
}
EXISTING_GAPS = [
    "B5", "K1", "K2", "K7", "K13", "K18", "K20", "K31", "K34",
    "S7", "S11", "S20", "S23", "S25",
]
AUTO_HIGH = {
    "B1": (1, 1, "Workshop Safety, Hazards, Housekeeping and Occupational Expectations"),
    "B2": (3, 30, "Environmental risk, spill response and emergency preparedness"),
    "B3": (6, 53, "Workshop productivity, task sequencing and team support"),
    "B4": (10, 100, "Portfolio-Based Reflective Learning and Evidence Improvement"),
    "K3": (1, 1, "Workshop Safety, Hazards, Housekeeping and Occupational Expectations"),
    "K4": (3, 30, "Environmental risk, spill response and emergency preparedness"),
    "K5": (1, 2, "Health and Safety, Tools, Equipment and Safe Vehicle Support"),
    "K9": (7, 64, "Tyre and TPMS service integration"),
    "K11": (5, 44, "Suspension component replacement and alignment preparation"),
    "K14": (6, 52, "Air-conditioning and climate-control checks"),
    "K17": (9, 89, "Pre-calibration checks: alignment, ride height and sensor inputs"),
    "K19": (2, 18, "Wheel Alignment - Advanced"),
    "K22": (9, 94, "Emerging Technology - Hydrogen Systems Safety and Application"),
    "K26": (2, 15, "Supplier Liaison"),
    "K27": (2, 19, "Stock Auditing"),
    "K33": (1, 10, "Technical Documentation, Job Cards, Handover and Specialist Transition"),
    "S5": (1, 5, "Measurement, Technical Information and Tolerances"),
    "S6": (3, 30, "Environmental risk, spill response and emergency preparedness"),
    "S8": (1, 7, "Multimeter Use, Electrical Measurement and Fabrication Quality"),
    "S17": (2, 19, "Stock Auditing"),
    "S18": (8, 78, "Quotations, authorisation chains and ethical upsell practice"),
    "S22": (1, 10, "Technical Documentation, Job Cards, Handover and Specialist Transition"),
    "S24": (10, 100, "Portfolio-Based Reflective Learning and Evidence Improvement"),
}


def rec(code, block, week, topic, source, evidence, reinforce, confidence, warnings=None):
    return {
        "ksbCode": code,
        "officialRequirement": DEFS[code]["statement"],
        "proposedPrimaryBlock": block,
        "proposedPrimaryBlockTitle": BLOCK_TITLES[block],
        "week": week,
        "topic": topic,
        "sourceDocument": "Autocare_L2_Lesson_Plans_v1.0 (original untouched)",
        "sourceVersion": "v1.0",
        "decisionSource": source,
        "confidence": confidence,
        "evidenceSummary": evidence,
        "reinforcementBlocks": reinforce,
        "warnings": warnings or [],
        "status": "REVIEW_ONLY_CANDIDATE",
    }


auto_high_list = [
    rec(code, b, w, t, "AUTOMATED_HIGH_CONFIDENCE",
        "Retained after human-review verification wave (original curriculum title/practical evidence).",
        [], "HIGH")
    for code, (b, w, t) in AUTO_HIGH.items()
]

human_verified = [
    rec("K15", 2, 12, "Electrical System Inspection", "HUMAN_APPROVED_AFTER_VERIFICATION",
        "W12 theory: battery construction, charging/alternator, starting/starter; practical tests; charging-fault application.",
        [1], "HIGH", ["B1 W04 = awareness reinforcement only."]),
    rec("K16", 2, 12, "Electrical System Inspection", "HUMAN_APPROVED_AFTER_VERIFICATION",
        "Same W12 substantive LV battery/starting/charging teaching and application.",
        [1], "HIGH", ["B1 W04 = awareness reinforcement only."]),
    rec("K32", 5, 41, "Technical handover and managing customer expectations on diagnostic work",
        "HUMAN_APPROVED_AFTER_VERIFICATION",
        "W41 deliberate verbal communication teaching + customer role-play (fault/cause/consequence/action).",
        [7, 9], "HIGH", ["B7 advanced communication = Reinforcement."]),
    rec("S21", 5, 41, "Technical handover and managing customer expectations on diagnostic work",
        "HUMAN_APPROVED_AFTER_VERIFICATION",
        "W41 verbal communication practice with customers/colleagues context via role-play and records.",
        [7, 9], "HIGH", ["B7 = Reinforcement."]),
    rec("S16", 3, 28, "Estimates, authorisation and customer approval skills",
        "HUMAN_APPROVED_AFTER_VERIFICATION",
        "W28 quotation build (labour/parts/VAT) + customer authorisation role-play — earlier substantive teaching.",
        [4, 5, 8], "HIGH"),
    rec("K6", 1, 2, "Health and Safety, Tools, Equipment and Safe Vehicle Support",
        "HUMAN_APPROVED_AFTER_VERIFICATION",
        "W02 objectives/theory/practice cover tool/equipment condition, calibration importance, pre-use checks, "
        "recording equipment checks, remove-from-use decisions, and calibration/maintenance examples in consolidation. "
        "B4/W37 rejected (COSHH title-only).",
        [8, 5], "HIGH",
        ["Dedicated long-term storage methods are thinner in W02; B8/W77 is Reinforcement for equipment care/storage routines."]),
    rec("K25", 6, 53, "Workshop productivity, task sequencing and team support",
        "HUMAN_APPROVED_AFTER_VERIFICATION",
        "W53 deliberately teaches workshop productivity without compromising safety, repair quality or customer satisfaction; "
        "multi-job planning against parts/time/customer requirements. B10/W105 rejected as consolidation ('revisiting').",
        [10, 3, 7], "MEDIUM",
        ["Official competitiveness and ethical issues are not explicit in W53 — core efficiency/customer-satisfaction/operational-risk content is present."]),
]

new_gaps = [
    {
        "ksbCode": "S9",
        "officialRequirement": DEFS["S9"]["statement"],
        "classification": "CURRICULUM_GAP",
        "decisionSource": "HUMAN_CONDITIONAL_FAILED_CONTENT_TEST",
        "why": "W64 fails strip/remove/replace/balance practical test; W14 TPMS and W106 consolidation rejected as Primary.",
        "partialEvidence": ["W14 TPMS", "W64 tyre/TPMS inspection integration", "W106 late consolidation"],
        "status": "REVIEW_ONLY_NEW_GAP",
    },
    {
        "ksbCode": "K10",
        "officialRequirement": DEFS["K10"]["statement"],
        "classification": "CURRICULUM_GAP",
        "decisionSource": "HUMAN_CONDITIONAL_FAILED_CONTENT_TEST",
        "why": "No original session teaches steering systems (mechanical/hydraulic/EPAS) purpose/function/location for inspect/remove/replace. W34 is geometry/tyre wear only.",
        "status": "REVIEW_ONLY_NEW_GAP",
    },
    {
        "ksbCode": "K28",
        "officialRequirement": DEFS["K28"]["statement"],
        "classification": "CURRICULUM_GAP",
        "decisionSource": "AUTOMATED_THEN_CONFIRMED",
        "why": "No FCA/PCI financial-compliance teaching in original curriculum.",
        "status": "REVIEW_ONLY_NEW_GAP",
    },
    {
        "ksbCode": "K8",
        "officialRequirement": DEFS["K8"]["statement"],
        "classification": "CURRICULUM_GAP",
        "decisionSource": "HUMAN_EVIDENCE_VERIFIED_GAP",
        "why": (
            "W10 is job-card/handover documentation, not service literature/manuals/warranties. "
            "W35 warranty alone does not cover full official K8 breadth. No combined teaching of service records + owner's manuals + warranties."
        ),
        "partialEvidenceRetainAsReinforcementOnly": [
            {"block": 4, "week": 35, "topic": "Warranty parts, returns and supplier escalation", "role": "PARTIAL_ONLY_NOT_PRIMARY"},
            {"block": 8, "week": 75, "topic": "Specialist parts, alternatives and warranty evidence", "role": "PARTIAL_ONLY_NOT_PRIMARY"},
        ],
        "proposedAmendmentHint": "Strengthen an existing documentation/service-information session rather than inventing a Primary mapping now.",
        "status": "REVIEW_ONLY_NEW_GAP",
    },
]

distributed = [
    {
        "ksbCode": "S10",
        "officialRequirement": DEFS["S10"]["statement"],
        "classification": "DISTRIBUTED_SKILL_PRIMARY_OWNERSHIP_PROBLEM",
        "decisionSource": "HUMAN_DECISION",
        "why": (
            "Teaching exists across multiple systems/blocks, but no single defensible Primary owner for the official multi-system breadth. "
            "Distinct from 'no teaching exists'."
        ),
        "evidenceExistsAcrossBlocks": [2, 3, 4, 5, 6, 7, 10],
        "status": "REVIEW_ONLY",
    }
]

existing_primary_list = [
    {
        "ksbCode": code,
        "approvedPrimaryBlock": block,
        "proposedPrimaryBlockTitle": BLOCK_TITLES[block],
        "status": "PERSISTED_CURRENT_TRUTH",
        "officialRequirement": DEFS[code]["statement"],
    }
    for code, block in EXISTING_APPROVED.items()
]
existing_gap_list = [
    {
        "ksbCode": code,
        "classification": "REVIEWED_CURRICULUM_GAP",
        "status": "CURRENT_TRUTH_GAP_REGISTER",
        "officialRequirement": DEFS[code]["statement"],
    }
    for code in EXISTING_GAPS
]

buckets = {
    "existingApprovedPrimaries": list(EXISTING_APPROVED),
    "automatedHighConfidencePrimaryCandidates": list(AUTO_HIGH),
    "humanVerifiedPrimaryCandidates": [x["ksbCode"] for x in human_verified],
    "existingReviewedGaps": EXISTING_GAPS[:],
    "newCurriculumGaps": [x["ksbCode"] for x in new_gaps],
    "distributedSkillProblems": ["S10"],
    "remainingGenuineAmbiguities": [],
}
accounted = []
dups = []
for codes in buckets.values():
    for c in codes:
        if c in accounted:
            dups.append(c)
        accounted.append(c)
missing = sorted(set(DEFS) - set(accounted))
total = (
    15 + len(AUTO_HIGH) + len(human_verified) + 14 + len(new_gaps) + len(distributed) + 0
)

report = {
    "status": "REVIEW_ONLY",
    "programmeVersionId": "231a8a32-d876-4312-a178-960d19dcf938",
    "title": "Autocare V1 FINAL Baseline Analysis — ready for human persist approval",
    "analyserVersion": "v2.2-final-human-verified",
    "notPersisted": True,
    "readyForFinalPersistApproval": True,
    "A_currentStateVerification": {
        "official": 64,
        "persistedApprovedPrimaries": 15,
        "existingReviewedGaps": 14,
        "unresolvedBeforeAnalysis": 35,
        "listMatchedExpected35": True,
    },
    "B_goldenSetAccuracy": PRIOR.get("B_goldenSetAccuracy"),
    "1_existingApprovedPrimariesPersisted": existing_primary_list,
    "2_automatedHighConfidencePrimaryCandidates": auto_high_list,
    "3_humanVerifiedPrimaryCandidates": human_verified,
    "4_existingReviewedGaps": existing_gap_list,
    "5_newCurriculumGaps": new_gaps,
    "6_distributedSkillPrimaryOwnershipProblems": distributed,
    "7_remainingGenuineAmbiguities": [],
    "8_reinforcementRecommendations": {
        "K15_K16": {"primary": 2, "reinforce": [1], "note": "B1 W04 awareness"},
        "K32_S21": {"primary": 5, "reinforce": [7, 9], "note": "B7/B9 advanced customer communication"},
        "S16": {"primary": 3, "reinforce": [4, 5, 8]},
        "K6": {"primary": 1, "reinforce": [8, 5], "note": "B8 W77 equipment care/storage; B1 W05 measuring-equipment calibration"},
        "K25": {"primary": 6, "reinforce": [10, 3, 7], "note": "B10 revisit only"},
        "K4_S6_B2": {"primary": 3, "reinforce": [], "note": "Coherent environmental family on W30"},
        "K8": {"primary": None, "partialOnly": [4, 8], "note": "Warranty partial — NOT Primary"},
        "S9": {"primary": None, "partialOnly": [2, 7, 10], "note": "Tyre/TPMS exposure — NOT Primary under strip/balance rule"},
        "S10": {"primary": None, "distributedReinforce": [2, 3, 4, 5, 6, 7], "note": "No Primary; distributed skill"},
    },
    "9_conditionalVerificationLedger": {
        "K15_K16": "APPROVED B2/W12",
        "S9": "GAP — W64 failed strip/balance practical test",
        "S10": "DISTRIBUTED_SKILL_PROBLEM",
        "K32_S21": "APPROVED B5/W41",
        "K8": "GAP — full breadth not taught; W35 partial only",
        "S16": "APPROVED B3/W28",
        "K6": "APPROVED B1/W02 after B4 reject + W02 content pass",
        "K10": "GAP — no steering-systems teaching",
        "K25": "APPROVED B6/W53 MEDIUM after B10 reject + W53 content pass (competitiveness/ethics weak)",
    },
    "10_exactAccountingAcross64": {
        "existingApprovedPrimaries": 15,
        "automatedHighConfidenceCandidates": len(AUTO_HIGH),
        "humanVerifiedCandidates": len(human_verified),
        "existingReviewedGaps": 14,
        "newCurriculumGaps": len(new_gaps),
        "distributedSkillProblems": 1,
        "remainingGenuineAmbiguities": 0,
        "totalAccountedFor": total,
        "buckets": buckets,
        "missingFromAccounting": missing,
        "duplicateInBuckets": dups,
        "identityCheck": "15+23+7+14+4+1+0 = 64",
    },
    "11_embeddedAiImplementationLearnings": [
        "Title/conditional approval must be invalidated by practical text (S9, K8, K6, K10).",
        "Partial coverage must not become Primary (K8 warranty-only).",
        "Distributed-skill state is distinct from gap (S10).",
        "Consolidation 'revisiting' weeks cannot own Primary (K25 W105).",
        "False friends: tool control≠tool maintenance; steering geometry≠steering systems; documentation≠owner manuals.",
        "Foundation Block 1 can legitimately own Autocare Primaries when content matches (K6, K3, etc.).",
        "Future amendment UX should prefer strengthening existing sessions over inventing Primaries for gaps.",
    ],
    "stopPoint": (
        "REVIEW_ONLY baseline analysis complete. Remaining genuine ambiguities: none. "
        "Awaiting explicit approval to persist new Primaries/gaps. Nothing written to programme truth."
    ),
}

assert total == 64 and not missing and not dups, (total, missing, dups)
out = ROOT / ".tmp-autocare-v1-ai-baseline-analysis.json"
out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps(report["10_exactAccountingAcross64"], indent=2))
print("saved", out)
