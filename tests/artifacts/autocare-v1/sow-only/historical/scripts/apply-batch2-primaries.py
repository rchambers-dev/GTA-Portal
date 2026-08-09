"""Apply batch-2 Primary decisions; build batch 3 (analysis only)."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
path = OUT / ".tmp-step4-reclassified-mappings.json"
d = json.loads(path.read_text(encoding="utf-8"))
decisions_path = OUT / ".tmp-primary-decisions.json"
decisions = json.loads(decisions_path.read_text(encoding="utf-8"))

batch2 = {
    "K30": {
        "primaryBlock": 3,
        "rationale": "Earliest clear team-working via bay discipline/handoffs; B8 advanced; B10 consolidation",
    },
    "S3": {
        "primaryBlock": 3,
        "rationale": "W27 Housekeeping/5S/safe storage first teaching home",
    },
    "S1": {
        "primaryBlock": 3,
        "rationale": "Earliest sustained workplace H&S practice; later blocks specialist/reinforcement",
    },
    "S2": {
        "primaryBlock": 3,
        "rationale": "First clear work-area preparation/housekeeping teaching",
    },
}

for code, meta in batch2.items():
    decisions["approvedPrimaries"][code] = meta
    primary = meta["primaryBlock"]
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
    {"batch": 2, "codes": list(batch2.keys()), "status": "approved", "approvals": batch2}
)

resolved = set(decisions["approvedPrimaries"])
# Remaining from prior queue + any still with multi primary flags not resolved
prior_queue = [
    "S4",
    "K29",
    "S19",
    "S14",
    "K21",
    "K23",
    "S13",
]
# Also scan for any valued KSB with !=1 primary among non-resolved
by_code = defaultdict(list)
for r in d["valuedMappings"]:
    by_code[r["ksbCode"]].append(r)

issues = []
for code, rows in sorted(by_code.items(), key=lambda x: (x[0][0], int(x[0][1:]))):
    if code in resolved:
        # verify invariant
        p = [r for r in rows if r["role"] == "PRIMARY"]
        if len(p) != 1:
            issues.append({"ksbCode": code, "issue": f"resolved but primary_count={len(p)}"})
        continue
    primaries = [r for r in rows if r["role"] == "PRIMARY"]
    if len(primaries) != 1:
        issues.append(
            {
                "ksbCode": code,
                "issue": "needs_human_primary",
                "primaryCount": len(primaries),
                "blocks": sorted(r["block"] for r in rows),
                "primaryBlocks": sorted(r["block"] for r in primaries),
            }
        )

# Next batch: prefer prior_queue order for multi-tied codes
batch3_codes = [c for c in prior_queue if c not in resolved][:4]
# If fewer than 4, fill from other unresolved
for item in issues:
    c = item["ksbCode"]
    if c not in batch3_codes and c not in resolved and len(batch3_codes) < 4:
        batch3_codes.append(c)

d["totals"]["humanApprovedPrimaries"] = decisions["approvedPrimaries"]
d["totals"]["resolvedPrimaryCount"] = len(decisions["approvedPrimaries"])
d["totals"]["remainingNeedsHumanPrimary"] = [
    i for i in issues if i.get("issue") == "needs_human_primary"
]

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

batch3 = []
for code in batch3_codes:
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
    batch3.append(
        {
            "ksbCode": code,
            "type": off[code]["ksb_type"],
            "description": off[code]["description"],
            "flag": flags.get(code),
            "candidates": candidates,
        }
    )

(OUT / ".tmp-primary-batch3.json").write_text(
    json.dumps(batch3, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(
    json.dumps(
        {
            "appliedBatch2": list(batch2.keys()),
            "resolvedCount": len(decisions["approvedPrimaries"]),
            "batch3Codes": batch3_codes,
            "unresolvedIssueCount": len([i for i in issues if i.get("issue") == "needs_human_primary"]),
            "verifyResolved": {
                c: [
                    (r["block"], r["role"])
                    for r in d["valuedMappings"]
                    if r["ksbCode"] == c
                ]
                for c in list(batch2.keys()) + ["K24", "S15", "K12", "S12"]
            },
        },
        indent=2,
    )
)
