"""Apply approved Primary decisions (analysis only — no DB persist)."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
path = OUT / ".tmp-step4-reclassified-mappings.json"
d = json.loads(path.read_text(encoding="utf-8"))

decisions_path = OUT / ".tmp-primary-decisions.json"
if decisions_path.exists():
    decisions = json.loads(decisions_path.read_text(encoding="utf-8"))
else:
    decisions = {"approvedPrimaries": {}, "batches": []}

batch1 = {
    "K24": {"primaryBlock": 2, "rationale": "First dedicated customer-service teaching (scenarios + dispute resolution)"},
    "S15": {"primaryBlock": 2, "rationale": "First clear practical customer-service skill application"},
    "K12": {"primaryBlock": 2, "rationale": "Advanced Brake Diagnostics strongest primary; B3 wear checks = reinforcement"},
    "S12": {"primaryBlock": 2, "rationale": "Wheel Alignment - Advanced first explicit geometry teaching; no B3 artefact"},
}

for code, meta in batch1.items():
    decisions["approvedPrimaries"][code] = meta

decisions["batches"].append(
    {
        "batch": 1,
        "codes": list(batch1.keys()),
        "status": "approved",
        "approvals": batch1,
    }
)

# Apply to valued mappings: exactly one PRIMARY each
for code, meta in batch1.items():
    primary = meta["primaryBlock"]
    for row in d["valuedMappings"]:
        if row["ksbCode"] != code:
            continue
        if row["block"] == primary:
            row["role"] = "PRIMARY"
            row["roleReason"] = f"Human-approved Primary Block {primary}"
            row["primarySource"] = "human_approved"
        else:
            # Keep as reinforcement only if already valued (genuine teaching)
            if row["role"] in ("PRIMARY", "REINFORCEMENT"):
                row["role"] = "REINFORCEMENT"
                row["roleReason"] = f"Reinforcement; Primary locked to Block {primary}"
                row["primarySource"] = "human_approved"

# Hard ensure S12 has no Block 3
d["valuedMappings"] = [
    r
    for r in d["valuedMappings"]
    if not (r["ksbCode"] == "S12" and r["block"] == 3)
]

# Refresh multi-primary flags for unresolved only
from collections import defaultdict

by_code = defaultdict(list)
for r in d["valuedMappings"]:
    by_code[r["ksbCode"]].append(r)

resolved = set(decisions["approvedPrimaries"])
still_multi = []
for code, rows in by_code.items():
    if code in resolved:
        continue
    primaries = [r for r in rows if r["role"] == "PRIMARY"]
    if len(primaries) > 1:
        still_multi.append(
            {
                "ksbCode": code,
                "primaryBlocks": sorted(r["block"] for r in primaries),
                "allBlocks": sorted(r["block"] for r in rows),
            }
        )

# Remaining algorithm multi-flags minus resolved
algo_multi = [
    f
    for f in d["totals"].get("multiPrimaryFlags", [])
    if f["ksbCode"] not in resolved
]

# Next batch candidates: prefer remaining multi-primary / tied
next_codes = []
for f in algo_multi:
    if f["ksbCode"] not in next_codes:
        next_codes.append(f["ksbCode"])
for m in still_multi:
    if m["ksbCode"] not in next_codes:
        next_codes.append(m["ksbCode"])

batch2_codes = next_codes[:4]

d["totals"]["humanApprovedPrimaries"] = decisions["approvedPrimaries"]
d["totals"]["resolvedPrimaryCount"] = len(decisions["approvedPrimaries"])
d["totals"]["remainingMultiPrimaryCandidates"] = next_codes

path.write_text(json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8")
decisions_path.write_text(json.dumps(decisions, indent=2, ensure_ascii=False), encoding="utf-8")

# Build batch 2 pack
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

batch2 = []
for code in batch2_codes:
    rows = [v for v in d["valuedMappings"] if v["ksbCode"] == code]
    candidates = []
    for r in sorted(rows, key=lambda x: x["block"]):
        weeks = []
        for t in r.get("evidenceTopics") or []:
            for w in sessions:
                if (
                    w.get("topic") == t
                    and w["block"] == r["block"]
                    and not w.get("excluded")
                ):
                    weeks.append(
                        {
                            "week": w["week"],
                            "duty": w.get("duty"),
                            "topic": t,
                        }
                    )
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
    batch2.append(
        {
            "ksbCode": code,
            "type": off[code]["ksb_type"],
            "description": off[code]["description"],
            "flag": flags.get(code),
            "candidates": candidates,
        }
    )

(OUT / ".tmp-primary-batch2.json").write_text(
    json.dumps(batch2, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(
    json.dumps(
        {
            "applied": list(batch1.keys()),
            "resolvedCount": len(decisions["approvedPrimaries"]),
            "batch2Codes": batch2_codes,
            "remainingQueue": next_codes,
        },
        indent=2,
    )
)
