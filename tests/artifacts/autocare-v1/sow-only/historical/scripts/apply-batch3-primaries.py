"""Apply batch-3 Primary decisions; audit S4@B9; build batch 4."""
from __future__ import annotations

import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
path = OUT / ".tmp-step4-reclassified-mappings.json"
d = json.loads(path.read_text(encoding="utf-8"))
decisions_path = OUT / ".tmp-primary-decisions.json"
decisions = json.loads(decisions_path.read_text(encoding="utf-8"))

# --- Audit W89 for S4 tool/equipment calibration ---
spec = Path(
    r"C:\Users\Reiss\Desktop\Portal Questions\AutoCare L2\Autocare_L2_Lesson_Plans\Autocare_L2_Lesson_Plans_v1.0\02_Specialist_Lesson_Plans"
)
w89 = next(spec.glob("Autocare_L2_Week_089_*.docx"))
with zipfile.ZipFile(w89) as z:
    xml = z.read("word/document.xml").decode("utf-8", "ignore")
plain = re.sub(r"</w:p>", "\n", xml)
plain = re.sub(r"<[^>]+>", "", plain)
plain = (
    plain.replace("&amp;", "&")
    .replace("&lt;", "<")
    .replace("&gt;", ">")
    .replace("&quot;", '"')
)
# Evidence search
tool_cal = bool(
    re.search(
        r"tool[s]?\s+(and\s+)?equipment|return tools|calibration check|store.*tool|hand tool|torque wrench|workshop tool",
        plain,
        re.I,
    )
)
adas_cal = bool(
    re.search(
        r"adas|sensor|camera|radar|alignment|ride height|geometry|pre-?calibration",
        plain,
        re.I,
    )
)
# Extract topic + a few activity lines
topic_m = re.search(r"\nTopic\s*\n\s*([^\n]+)", plain, re.I)
aims = re.search(r"Lesson aims\s*\n((?:[^\n]+\n){1,6})", plain, re.I)
acts = re.findall(r"\d{2}:\d{2}-\d{2}:\d{2}[\d.]*\s*OTJ\s*\n([^\n]+)", plain, re.I)
s4_b9_audit = {
    "week": 89,
    "file": w89.name,
    "topic": topic_m.group(1).strip() if topic_m else None,
    "aimsSnippet": re.sub(r"\s+", " ", aims.group(1)).strip()[:400] if aims else None,
    "activitySnippets": [a.strip()[:200] for a in acts[:4]],
    "mentionsToolEquipmentStoreOrCalibration": tool_cal,
    "mentionsAdasAlignmentSensorCalibration": adas_cal,
    "keepS4Block9Reinforcement": False,  # default deny unless tool evidence
}
if tool_cal and not (adas_cal and not re.search(r"tool|equipment store|return tools", plain, re.I)):
    # Only keep if clear tool/equipment teaching independent of ADAS-only
    if re.search(r"store|return|hand tool|workshop tool|torque|maintain.*equipment", plain, re.I):
        s4_b9_audit["keepS4Block9Reinforcement"] = True

batch3 = {
    "S4": {
        "primaryBlock": 4,
        "rationale": "Clearest tool-control teaching; B3/B8 reinforcement; B9 dropped unless tool-cal evidence",
        "dropBlocks": [] if s4_b9_audit["keepS4Block9Reinforcement"] else [9],
    },
    "K29": {
        "primaryBlock": 3,
        "rationale": "First estimates/authorisation teaching; later quotation blocks reinforcement",
    },
    "S19": {
        "primaryBlock": 3,
        "rationale": "Aligned with K30→B3; B8 advanced delegation reinforcement",
    },
    "S14": {
        "primaryBlock": 6,
        "rationale": "First dedicated high-intensity record-keeping/compliance/audit teaching; B8 advanced; B10 consolidation",
    },
}

for code, meta in batch3.items():
    decisions["approvedPrimaries"][code] = {
        "primaryBlock": meta["primaryBlock"],
        "rationale": meta["rationale"],
    }
    primary = meta["primaryBlock"]
    drop = set(meta.get("dropBlocks") or [])
    # Remove dropped valued mappings
    d["valuedMappings"] = [
        r
        for r in d["valuedMappings"]
        if not (r["ksbCode"] == code and r["block"] in drop)
    ]
    for row in d["valuedMappings"]:
        if row["ksbCode"] != code:
            continue
        if row["block"] == primary:
            row["role"] = "PRIMARY"
            row["roleReason"] = f"Human-approved Primary Block {primary}"
            row["primarySource"] = "human_approved"
        else:
            row["role"] = "REINFORCEMENT"
            row["roleReason"] = f"Reinforcement; Primary locked to Block {primary}"
            row["primarySource"] = "human_approved"

decisions["batches"].append(
    {
        "batch": 3,
        "codes": list(batch3.keys()),
        "status": "approved",
        "approvals": batch3,
        "s4_b9_audit": s4_b9_audit,
    }
)

resolved = set(decisions["approvedPrimaries"])
remaining_multi = [
    f["ksbCode"]
    for f in d["totals"].get("multiPrimaryFlags", [])
    if f["ksbCode"] not in resolved
]
# Next batch: remaining multi + start unmapped if multi done
batch4_codes = remaining_multi[:4]

d["totals"]["humanApprovedPrimaries"] = decisions["approvedPrimaries"]
d["totals"]["resolvedPrimaryCount"] = len(decisions["approvedPrimaries"])
d["totals"]["s4_b9_audit"] = s4_b9_audit

path.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
decisions_path.write_text(json.dumps(decisions, indent=2, ensure_ascii=False), encoding="utf-8")

off = {
    x["ksb_code"]: x
    for x in json.loads((OUT / ".tmp-official-ksbs-v13.json").read_text(encoding="utf-8"))
}
sessions = json.loads((OUT / ".tmp-sow-sessions-rich.json").read_text(encoding="utf-8"))["weeks"]
titles = {
    int(k): v["title"]
    for k, v in json.loads((OUT / ".tmp-step4-recommended-mappings.json").read_text(encoding="utf-8"))[
        "perBlockCounts"
    ].items()
}
flags = {f["ksbCode"]: f for f in d["totals"].get("multiPrimaryFlags", [])}

batch4 = []
for code in batch4_codes:
    rows = [v for v in d["valuedMappings"] if v["ksbCode"] == code]
    candidates = []
    for r in sorted(rows, key=lambda x: x["block"]):
        weeks = []
        for t in r.get("evidenceTopics") or []:
            for w in sessions:
                if w.get("topic") == t and w["block"] == r["block"] and not w.get("excluded"):
                    weeks.append({"week": w["week"], "duty": w.get("duty"), "topic": t})
        candidates.append(
            {
                "block": r["block"],
                "title": titles.get(r["block"], ""),
                "currentRole": r["role"],
                "score": r.get("bestScore"),
                "topics": r.get("evidenceTopics"),
                "weeks": weeks,
            }
        )
    batch4.append(
        {
            "ksbCode": code,
            "type": off[code]["ksb_type"],
            "description": off[code]["description"],
            "flag": flags.get(code),
            "candidates": candidates,
        }
    )

# If multi flags exhausted early, prepare unmapped decision stubs
unmapped = d["totals"].get("stillUnmapped", [])
(OUT / ".tmp-primary-batch4.json").write_text(
    json.dumps(
        {
            "batch4": batch4,
            "s4_b9_audit": s4_b9_audit,
            "remainingMultiAfterThis": [c for c in remaining_multi if c not in batch4_codes],
            "unmappedAwaitingDecision": unmapped,
            "resolvedCount": len(resolved),
        },
        indent=2,
        ensure_ascii=False,
    ),
    encoding="utf-8",
)

verify = {}
for c in ["S4", "K29", "S19", "S14"]:
    verify[c] = sorted(
        (r["block"], r["role"]) for r in d["valuedMappings"] if r["ksbCode"] == c
    )

print(
    json.dumps(
        {
            "applied": list(batch3.keys()),
            "s4_b9_kept": s4_b9_audit["keepS4Block9Reinforcement"],
            "s4_b9_topic": s4_b9_audit["topic"],
            "s4_b9_toolEvidence": s4_b9_audit["mentionsToolEquipmentStoreOrCalibration"],
            "s4_b9_adasEvidence": s4_b9_audit["mentionsAdasAlignmentSensorCalibration"],
            "verify": verify,
            "batch4Codes": batch4_codes,
            "remainingMulti": [c for c in remaining_multi if c not in batch4_codes],
            "unmappedCount": len(unmapped),
        },
        indent=2,
    )
)
