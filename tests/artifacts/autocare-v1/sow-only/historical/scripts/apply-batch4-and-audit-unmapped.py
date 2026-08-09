"""Apply batch-4 EV Primaries; deep-audit 14 unmapped KSBs for human Primary decisions."""
from __future__ import annotations

import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

OUT = Path(r"D:\GTA Portal")
ROOT = Path(r"C:\Users\Reiss\Desktop\Portal Questions\AutoCare L2")
spec = (
    ROOT
    / "Autocare_L2_Lesson_Plans"
    / "Autocare_L2_Lesson_Plans_v1.0"
    / "02_Specialist_Lesson_Plans"
)
fs = (
    ROOT
    / "Autocare_L2_Lesson_Plans"
    / "Autocare_L2_Lesson_Plans_v1.0"
    / "01_Foundation_Skills_Lesson_Plans"
)

d = json.loads((OUT / ".tmp-step4-reclassified-mappings.json").read_text(encoding="utf-8"))
dec = json.loads((OUT / ".tmp-primary-decisions.json").read_text(encoding="utf-8"))
official = {
    r["ksb_code"].upper(): r
    for r in json.loads((OUT / ".tmp-official-ksbs-v13.json").read_text(encoding="utf-8"))
}
sessions = json.loads((OUT / ".tmp-sow-sessions-rich.json").read_text(encoding="utf-8"))["weeks"]
titles = {
    int(k): v["title"]
    for k, v in json.loads((OUT / ".tmp-step4-recommended-mappings.json").read_text(encoding="utf-8"))[
        "perBlockCounts"
    ].items()
}
rec = json.loads((OUT / ".tmp-step4-recommended-mappings.json").read_text(encoding="utf-8"))

batch4 = {
    "K21": {
        "primaryBlock": 6,
        "rationale": "First dedicated EV service/charging/safety teaching; B9 specialist reinforcement",
    },
    "K23": {
        "primaryBlock": 6,
        "rationale": "Strongest HV safe working/isolation match; B9 reinforces later",
    },
    "S13": {
        "primaryBlock": 6,
        "rationale": "Primary practical home for EV isolation for maintenance; B9 reinforcement",
    },
}
for code, meta in batch4.items():
    dec["approvedPrimaries"][code] = meta
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

dec["batches"].append(
    {"batch": 4, "codes": list(batch4.keys()), "status": "approved", "approvals": batch4}
)

# Anchors for unmapped scan (official-aligned)
ANCHORS = {
    "B5": r"inclusive|respect|diversity|equity|different views",
    "K1": r"industry|role of|reporting channel|autocare technician|limits of autonomy|autonomy",
    "K2": r"safety inspection|routine maintenance|manufacturers? specification|serviceability|service schedule",
    "K7": r"workplace instruction",
    "K13": r"emission|catalytic|\begr\b|\bdpf\b|exhaust|\bscr\b|\bppf\b|particulate",
    "K18": r"adas|levels of autonomy|passive and active|driver[-\s]?assistance",
    "K20": r"brake fluid|oil filter|air filter|filtration",
    "K31": r"equity|diversity|inclusion|inclusive",
    "K34": r"digital|email|gdpr|cyber|database|software|point of sale|collaboration|word process|management information",
    "S7": r"safety inspection|routine maintenance|service schedule",
    "S11": r"high voltage|electrified|hybrid|state-of-health|onboard charger|hv battery",
    "S20": r"equity|diversity|inclusion|inclusive",
    "S23": r"digital|gdpr|cyber|software|email|database|management information|point of sale",
    "S25": r"fluids?|filtration|oil filter|air filter|brake fluid",
}

EXTRA = {
    "B5": {"inclusive", "respect", "diversity", "equity"},
    "K1": {"industry", "autonomy", "reporting", "role"},
    "K2": {"inspection", "maintenance", "schedule", "serviceability", "specification"},
    "K7": {"instruction", "instructions", "workplace"},
    "K13": {"emission", "catalytic", "exhaust", "dpf", "egr"},
    "K18": {"adas", "autonomy", "assistance"},
    "K20": {"fluid", "filter", "filtration", "oil"},
    "K31": {"equity", "diversity", "inclusion"},
    "K34": {"digital", "email", "gdpr", "cyber", "software", "database"},
    "S7": {"inspection", "maintenance", "schedule"},
    "S11": {"voltage", "battery", "charger", "electrified", "hybrid"},
    "S20": {"equity", "diversity", "inclusion"},
    "S23": {"digital", "gdpr", "cyber", "software"},
    "S25": {"fluid", "filter", "filtration"},
}

STOP = {
    "the","a","an","and","or","of","to","in","on","for","with","using","use","from","that","this",
    "into","as","by","at","is","are","be","been","vehicle","vehicles","including","example","examples",
    "such","their","them","they","when","where","which","while","within","without","through","during",
    "after","before","between","also","other","used","work","working","workplace","activity","activities",
    "appropriate","relevant","required","requirements","procedures","procedure","process","processes",
    "systems","system","components","component","principles","principle","information","ensure","apply",
    "applied","application","level","basic","advanced","purpose","function","location","checks","check",
}


def toks(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 3 and w not in STOP}


def docx_plain(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "ignore")
    plain = re.sub(r"</w:p>", "\n", xml)
    plain = re.sub(r"<[^>]+>", "", plain)
    return plain.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')


def score(code: str, topic: str | None, activity: str | None = None) -> float:
    blob_topic = topic or ""
    blob_act = activity or ""
    anchor = ANCHORS.get(code)
    topic_anchor = bool(anchor and re.search(anchor, blob_topic, re.I))
    terms = toks(official[code]["description"]) | EXTRA.get(code, set())
    th = len(terms & toks(blob_topic))
    ah = len(terms & toks(blob_act))
    if topic_anchor:
        return round(max(4.0, th * 2 + min(ah, 4) * 0.5), 3)
    if th == 0:
        return 0.0
    return round(th * 2 + min(ah, 4) * 0.5, 3)


unmapped = d["totals"].get("stillUnmapped") or [
    "B5","K1","K2","K7","K13","K18","K20","K31","K34","S7","S11","S20","S23","S25"
]

# Also scan foundation skills docs for Block 1 prose (no KSB codes)
fs_hits = defaultdict(list)
if fs.exists():
    for path_fs in sorted(fs.glob("*.docx")):
        plain = docx_plain(path_fs)
        for code in unmapped:
            if ANCHORS.get(code) and re.search(ANCHORS[code], plain, re.I):
                # snip
                m = re.search(ANCHORS[code], plain, re.I)
                snip = re.sub(r"\s+", " ", plain[max(0, m.start()-40): m.end()+80]) if m else ""
                fs_hits[code].append({"file": path_fs.name, "snippet": snip[:180]})

reports = []
for code in unmapped:
    focus_hits = []
    topic_hits = []
    for w in sessions:
        in_focus = code in (w.get("codes") or [])
        if in_focus:
            focus_hits.append(
                {
                    "week": w["week"],
                    "block": w["block"],
                    "excluded": w["excluded"],
                    "topic": w.get("topic"),
                    "duty": w.get("duty"),
                }
            )
        if w.get("excluded"):
            continue
        sc = score(code, w.get("topic"), w.get("activityText"))
        if sc >= 2.0:
            topic_hits.append(
                {
                    "week": w["week"],
                    "block": w["block"],
                    "topic": w.get("topic"),
                    "duty": w.get("duty"),
                    "score": sc,
                    "title": titles.get(w["block"], ""),
                }
            )

    # recommended medium/high history
    pipe = [
        {
            "block": r["block"],
            "confidence": r["confidence"],
            "sessionEvidenceCount": r.get("sessionEvidenceCount"),
        }
        for r in rec["recommendedMappings"]
        if r["ksbCode"] == code
    ]

    # Candidate blocks = unique blocks with topic score >=4 or (focus included + topic >=2)
    cand_scores = defaultdict(list)
    for h in topic_hits:
        cand_scores[h["block"]].append(h)
    candidates = []
    for b, hits in sorted(cand_scores.items()):
        best = max(hits, key=lambda x: x["score"])
        candidates.append(
            {
                "block": b,
                "title": titles.get(b, ""),
                "bestScore": best["score"],
                "evidenceWeeks": sorted(hits, key=lambda x: -x["score"]),
            }
        )
    candidates.sort(key=lambda x: (-x["bestScore"], x["block"]))

    strong = [c for c in candidates if c["bestScore"] >= 4.0]
    included_focus = [h for h in focus_hits if not h["excluded"]]
    excluded_focus_only = focus_hits and not included_focus

    if strong:
        suggested = strong[0]["block"]
        verdict = "MAPPABLE_NEEDS_PRIMARY_DECISION"
        why = "Defensible topic/anchor evidence exists in SOW; needs human Primary choice"
    elif candidates:
        suggested = candidates[0]["block"]
        verdict = "WEAK_EVIDENCE_NEEDS_DECISION"
        why = "Some topical signal but below strong threshold — curriculum gap risk if forced"
    elif included_focus:
        suggested = None
        verdict = "FOCUS_LIST_ONLY"
        why = "Appears on Duty/KSB focus lists without distinctive topic teaching evidence — reference-only unless you designate a Primary from SOW redesign"
    elif excluded_focus_only:
        suggested = None
        verdict = "ONLY_IN_EXCLUDED_OVERSIZED_WEEKS"
        why = "Only listed in oversized/dump weeks that were excluded from valued evidence"
    elif fs_hits.get(code):
        suggested = 1
        verdict = "FOUNDATION_PROSE_ONLY_BLOCK1"
        why = "Possible Foundation Skills prose signal without coded KSB cross-reference — Block 1 mapping still not defensible without approved FS KSB links"
    else:
        suggested = None
        verdict = "GENUINE_CURRICULUM_GAP"
        why = "No focus listing and no topic/anchor teaching evidence in approved specialist SOW"

    reports.append(
        {
            "ksbCode": code,
            "type": official[code]["ksb_type"],
            "description": official[code]["description"],
            "relatedDuties": official[code].get("related_duties") or official[code].get("duties"),
            "verdict": verdict,
            "why": why,
            "suggestedPrimary": suggested,
            "candidates": candidates,
            "focusHitsIncluded": included_focus[:8],
            "focusHitsExcludedSample": [h for h in focus_hits if h["excluded"]][:5],
            "pipelineRows": pipe[:8],
            "foundationProseHits": fs_hits.get(code, [])[:3],
        }
    )

# Update totals
d["totals"]["humanApprovedPrimaries"] = dec["approvedPrimaries"]
d["totals"]["resolvedPrimaryCount"] = len(dec["approvedPrimaries"])
d["totals"]["multiPrimaryHumanResolved"] = True
d["unmappedAudit"] = reports

(OUT / ".tmp-step4-reclassified-mappings.json").write_text(
    json.dumps(d, indent=2, ensure_ascii=False), encoding="utf-8"
)
(OUT / ".tmp-primary-decisions.json").write_text(
    json.dumps(dec, indent=2, ensure_ascii=False), encoding="utf-8"
)
(OUT / ".tmp-unmapped-audit.json").write_text(
    json.dumps({"count": len(reports), "items": reports}, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

# Compact print for next questions - first batch of unmapped (4)
summary = []
for r in reports:
    summary.append(
        {
            "code": r["ksbCode"],
            "verdict": r["verdict"],
            "suggested": r["suggestedPrimary"],
            "topCandidates": [
                {"block": c["block"], "score": c["bestScore"], "topics": [w["topic"] for w in c["evidenceWeeks"][:2]]}
                for c in r["candidates"][:3]
            ],
        }
    )
print(json.dumps({
    "appliedEV": list(batch4.keys()),
    "resolvedPrimaries": len(dec["approvedPrimaries"]),
    "unmappedSummary": summary,
    "verifyEV": {
        c: sorted((r["block"], r["role"]) for r in d["valuedMappings"] if r["ksbCode"] == c)
        for c in batch4
    },
}, indent=2))
