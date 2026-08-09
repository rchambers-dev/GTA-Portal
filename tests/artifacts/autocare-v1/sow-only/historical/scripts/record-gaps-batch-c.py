"""Record unmapped batch C gaps; prepare final unmapped batch D (S23, S25)."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
dec = json.loads((OUT / ".tmp-primary-decisions.json").read_text(encoding="utf-8"))
audit = json.loads((OUT / ".tmp-unmapped-audit.json").read_text(encoding="utf-8"))
d = json.loads((OUT / ".tmp-step4-reclassified-mappings.json").read_text(encoding="utf-8"))
strict = json.loads((OUT / ".tmp-unmapped-strict-checks.json").read_text(encoding="utf-8"))
by = {i["ksbCode"]: i for i in audit["items"]}

batch_c = {
    "K13": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "No explicit emissions teaching (catalytic/EGR/DPF/PPF/SCR). Do not assign by suspension/inspection proximity.",
        "likelyDesignAreas": ["B2", "B4", "B5", "B10"],
        "cluster": None,
        "doNotAssignNearestBlock": True,
    },
    "K20": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "No defensible fluids/filtration teaching (brake fluid, oil/oil filters, air filters). Do not use brake diagnostics as nearest Primary. Cluster with S25.",
        "likelyDesignAreas": ["B2", "B3", "B10"],
        "cluster": "fluids_filtration",
        "doNotAssignNearestBlock": True,
    },
    "K31": {
        "status": "CURRICULUM_GAP_FOCUS_TEMPLATE_ONLY",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "EDI knowledge gap cluster with S20+B5. Templated focus lists insufficient.",
        "likelyDesignAreas": ["B2", "B3", "B10"],
        "cluster": "edi",
        "doNotAssignNearestBlock": True,
    },
    "S7": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "Tied to K2 gap. Needs explicit safety inspection + routine maintenance using schedules/vehicle-specific data/wear limits. Do not assign B2/B10 by title proximity.",
        "likelyDesignAreas": ["B2", "B3", "B10"],
        "cluster": "inspection_to_spec",
        "doNotAssignNearestBlock": True,
    },
}

for code, meta in batch_c.items():
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
        "batch": "unmapped-C",
        "codes": list(batch_c.keys()),
        "status": "curriculum_gap_recorded",
        "approvals": batch_c,
    }
)

remaining = [
    c
    for c in (i["ksbCode"] for i in audit["items"])
    if c not in dec["curriculumGaps"] and c not in dec.get("approvedPrimaries", {})
]

d["totals"]["curriculumGaps"] = dec["curriculumGaps"]
d["totals"]["curriculumGapCount"] = len(dec["curriculumGaps"])
d["totals"]["publicationBlocked"] = True

(OUT / ".tmp-primary-decisions.json").write_text(
    json.dumps(dec, indent=2, ensure_ascii=False), encoding="utf-8"
)
(OUT / ".tmp-step4-reclassified-mappings.json").write_text(
    json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8"
)

batch_d = []
for code in remaining:
    item = by[code]
    batch_d.append(
        {
            **item,
            "strictSample": strict.get(code, [])[:3],
            "strictAny": any(x.get("hasStrictEvidence") for x in strict.get(code, [])),
        }
    )
(OUT / ".tmp-unmapped-batch-d.json").write_text(
    json.dumps({"remaining": remaining, "batchD": batch_d}, indent=2, ensure_ascii=False),
    encoding="utf-8",
)
print(json.dumps({"gapCount": len(dec["curriculumGaps"]), "remaining": remaining}, indent=2))
