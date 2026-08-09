"""Record unmapped gap decisions; prepare next unmapped batch."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
dec_path = OUT / ".tmp-primary-decisions.json"
audit_path = OUT / ".tmp-unmapped-audit.json"
map_path = OUT / ".tmp-step4-reclassified-mappings.json"

dec = json.loads(dec_path.read_text(encoding="utf-8"))
audit = json.loads(audit_path.read_text(encoding="utf-8"))
d = json.loads(map_path.read_text(encoding="utf-8"))
by = {i["ksbCode"]: i for i in audit["items"]}

if "curriculumGaps" not in dec:
    dec["curriculumGaps"] = {}

batch_a = {
    "K18": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "ADAS levels of autonomy (passive/active) not taught; W89 is pre-calibration only. Likely add explicit ADAS teaching in advanced/emerging-tech block.",
        "likelyDesignAreas": ["B9", "B10"],
        "doNotAssignNearestBlock": True,
    },
    "S11": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "No explicit HV battery/charger SoH testing activity found in W54/W82. Need practical SoH session before B6 or B9 can be Primary.",
        "likelyDesignAreas": ["B6", "B9"],
        "doNotAssignNearestBlock": True,
    },
    "S20": {
        "status": "CURRICULUM_GAP_FOCUS_TEMPLATE_ONLY",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "EDI appears only on templated Duty/KSB focus lists; need explicit EDI teaching/application.",
        "likelyDesignAreas": ["B2", "B3", "B10"],
        "doNotAssignNearestBlock": True,
    },
    "K34": {
        "status": "CURRICULUM_GAP",
        "label": "OFFICIAL KSB REQUIRED + NO DEFENSIBLE PRIMARY YET + CURRICULUM AMENDMENT REQUIRED",
        "notes": "No digital/GDPR/cyber/systems teaching found; stock-security was false friend. Need explicit digital systems curriculum.",
        "likelyDesignAreas": ["B5", "B7", "B9", "B10"],
        "doNotAssignNearestBlock": True,
    },
}

for code, meta in batch_a.items():
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
            "foundationProseHits": evidence.get("foundationProseHits") or [],
        },
        "publicationBlocker": True,
    }

dec["batches"].append(
    {
        "batch": "unmapped-A",
        "codes": list(batch_a.keys()),
        "status": "curriculum_gap_recorded",
        "approvals": batch_a,
    }
)

# Remaining unmapped to process
all_unmapped = [i["ksbCode"] for i in audit["items"]]
remaining = [c for c in all_unmapped if c not in dec["curriculumGaps"] and c not in dec.get("approvedPrimaries", {})]

d["totals"]["curriculumGaps"] = dec["curriculumGaps"]
d["totals"]["curriculumGapCount"] = len(dec["curriculumGaps"])
d["totals"]["publicationBlocked"] = True
d["totals"]["publicationBlockReason"] = (
    "Every required official KSB must have exactly one defensible Primary before programme publication."
)

dec_path.write_text(json.dumps(dec, indent=2, ensure_ascii=False), encoding="utf-8")
map_path.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")

# Build next batch B of 4 from remaining with enriched honest verdicts after strict checks
strict = json.loads((OUT / ".tmp-unmapped-strict-checks.json").read_text(encoding="utf-8"))
next_codes = remaining[:4]
batch_b = []
for code in next_codes:
    item = by[code]
    strict_note = None
    if code in strict:
        any_hit = any(x.get("hasStrictEvidence") for x in strict[code])
        # K1 header false friends
        if code == "K1":
            any_hit = False
            strict_note = "Header 'Autocare Technician' matches are NOT K1 teaching evidence."
        elif code in ("K2", "K13", "K20", "S7", "S25", "S23", "K7", "B5", "K31"):
            any_hit = any(x.get("hasStrictEvidence") for x in strict.get(code, []))
            if not any_hit:
                strict_note = "Strict content search found no defensible teaching language in sampled candidate weeks."
        item = {
            **item,
            "strictEvidenceFound": any_hit,
            "strictNote": strict_note,
            "strictSample": strict.get(code, [])[:3],
        }
    batch_b.append(item)

(OUT / ".tmp-unmapped-batch-b.json").write_text(
    json.dumps(
        {
            "recordedGaps": list(batch_a.keys()),
            "gapCount": len(dec["curriculumGaps"]),
            "remaining": remaining,
            "batchB": batch_b,
        },
        indent=2,
        ensure_ascii=False,
    ),
    encoding="utf-8",
)
print(
    json.dumps(
        {
            "recordedGaps": list(batch_a.keys()),
            "gapCount": len(dec["curriculumGaps"]),
            "remaining": remaining,
            "batchBCodes": next_codes,
        },
        indent=2,
    )
)
