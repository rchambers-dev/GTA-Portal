"""Record unmapped batch B gaps; prepare batch C."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
dec_path = OUT / ".tmp-primary-decisions.json"
audit_path = OUT / ".tmp-unmapped-audit.json"
map_path = OUT / ".tmp-step4-reclassified-mappings.json"
strict_path = OUT / ".tmp-unmapped-strict-checks.json"

dec = json.loads(dec_path.read_text(encoding="utf-8"))
audit = json.loads(audit_path.read_text(encoding="utf-8"))
d = json.loads(map_path.read_text(encoding="utf-8"))
strict = json.loads(strict_path.read_text(encoding="utf-8"))
by = {i["ksbCode"]: i for i in audit["items"]}

batch_b = {
    "B5": {
        "status": "CURRICULUM_GAP_FOCUS_TEMPLATE_ONLY",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": (
            "Do not use generic team-support language as inclusive-workplace proof. "
            "Needs explicit inclusion/respect/EDI teaching or application."
        ),
        "likelyDesignAreas": ["B2", "B3", "B10"],
        "doNotAssignNearestBlock": True,
    },
    "K1": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": (
            "Do not use lesson headers. Needs explicit teaching: automotive industry context, "
            "role of autocare technician, limits of autonomy, reporting channels. "
            "May fit early foundation/induction only after that content exists."
        ),
        "likelyDesignAreas": ["B1", "B2"],
        "doNotAssignNearestBlock": True,
    },
    "K2": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": (
            "Needs explicit manufacturer specifications, approved schedules, vehicle-specific data, "
            "legal wear/serviceability. Do not assign B2/B3 only because they contain inspection/brake-wear."
        ),
        "likelyDesignAreas": ["B2", "B3", "B10"],
        "doNotAssignNearestBlock": True,
    },
    "K7": {
        "status": "CURRICULUM_GAP_WEAK_EVIDENCE",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": (
            "Needs explicit workplace-instructions teaching for inspection/maintenance/replacement. "
            "Generic replacement/inspection sessions are insufficient."
        ),
        "likelyDesignAreas": ["B2", "B3", "B5"],
        "doNotAssignNearestBlock": True,
    },
}

for code, meta in batch_b.items():
    evidence = by.get(code, {})
    dec["curriculumGaps"][code] = {
        **meta,
        "type": evidence.get("type"),
        "description": evidence.get("description"),
        "evidenceSnapshot": {
            "verdict": evidence.get("verdict"),
            "why": evidence.get("why"),
            "focusHitsIncludedSample": (evidence.get("focusHitsIncluded") or [])[:5],
            "candidatesRejectedAsInsufficient": evidence.get("candidates") or [],
            "strictSample": strict.get(code, [])[:3],
        },
        "publicationBlocker": True,
    }

dec["batches"].append(
    {
        "batch": "unmapped-B",
        "codes": list(batch_b.keys()),
        "status": "curriculum_gap_recorded",
        "approvals": batch_b,
    }
)

remaining = [
    c
    for c in (i["ksbCode"] for i in audit["items"])
    if c not in dec["curriculumGaps"] and c not in dec.get("approvedPrimaries", {})
]
batch_c_codes = remaining[:4]
batch_c = []
for code in batch_c_codes:
    item = by[code]
    batch_c.append(
        {
            **item,
            "strictSample": strict.get(code, [])[:3],
            "strictAny": any(x.get("hasStrictEvidence") for x in strict.get(code, [])),
        }
    )

d["totals"]["curriculumGaps"] = dec["curriculumGaps"]
d["totals"]["curriculumGapCount"] = len(dec["curriculumGaps"])
d["totals"]["publicationBlocked"] = True

dec_path.write_text(json.dumps(dec, indent=2, ensure_ascii=False), encoding="utf-8")
map_path.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
(OUT / ".tmp-unmapped-batch-c.json").write_text(
    json.dumps({"remaining": remaining, "batchC": batch_c}, indent=2, ensure_ascii=False),
    encoding="utf-8",
)
print(json.dumps({"gapCount": len(dec["curriculumGaps"]), "remaining": remaining, "batchC": batch_c_codes}, indent=2))
