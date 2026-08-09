#!/usr/bin/env python3
"""Autocare V1 baseline analysis v2 — REVIEW ONLY. Original curriculum evidence only."""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(r"D:\GTA Portal")
CORPUS = json.loads((ROOT / ".tmp-original-curriculum-corpus.json").read_text(encoding="utf-8"))
VERIFY = json.loads((ROOT / ".tmp-v1-unresolved-verify.json").read_text(encoding="utf-8"))
DEFS = VERIFY["definitions"]
UNRESOLVED = VERIFY["unresolved"]

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

GOLDEN_PRIMARIES = {
    "K12": 2, "K24": 2, "S12": 2, "S15": 2,
    "K29": 3, "K30": 3, "S1": 3, "S2": 3, "S3": 3, "S19": 3,
    "S4": 4,
    "K21": 6, "K23": 6, "S13": 6, "S14": 6,
}
GOLDEN_GAPS = {
    "K1","B5","K31","S20","K7","K2","S7","K20","S25","K13","K34","S23","K18","S11"
}
LATE_WEEKS = set(range(100, 114))
STOCK_AIM = "develop secure occupational knowledge"


@dataclass
class Hit:
    week: int
    block: int
    topic: str
    score: float
    reasons: list[str] = field(default_factory=list)
    snippets: list[str] = field(default_factory=list)
    title_hit: bool = False
    practical_hit: bool = False


def as_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(as_text(v) for v in value)
    if isinstance(value, dict):
        return " ".join(as_text(v) for v in value.values())
    return str(value)


def contains(text: str, phrase: str) -> bool:
    phrase = phrase.lower().strip()
    if not phrase:
        return False
    # word-boundary-ish for short tokens; substring for multiword
    if " " in phrase or len(phrase) > 4:
        return phrase in text
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text) is not None


def focus_count(s: dict) -> int:
    return len(set(re.findall(r"\b[KSB]\d+\b", (s.get("focusLine") or "").upper())))


def session_parts(s: dict) -> dict:
    topic = as_text(s.get("topic")).lower()
    title = as_text(s.get("title")).lower()
    aims = as_text(s.get("aims")).lower()
    objectives = as_text(s.get("learningObjectives")).lower()
    assessment = as_text(s.get("assessment")).lower()
    theory = practical = application = consolidation = ""
    acts = s.get("activities") or {}
    if isinstance(acts, dict):
        theory = as_text(acts.get("theory")).lower()
        practical = as_text(acts.get("practical")).lower()
        application = as_text(acts.get("application")).lower()
        consolidation = as_text(acts.get("consolidation")).lower()
    # demote stock aims
    if STOCK_AIM in aims:
        aims = ""
    body_core = " ".join([topic, title, practical, application, theory, objectives, assessment])
    return {
        "topic": topic,
        "title": title,
        "aims": aims,
        "practical": practical + " " + application,
        "theory": theory,
        "body": body_core,
        "all": body_core + " " + consolidation + " " + aims,
    }


SESSIONS = []
for s in CORPUS["sessions"]:
    SESSIONS.append({**s, "_p": session_parts(s), "_focus": focus_count(s)})


def score_session(s: dict, q: dict) -> Hit | None:
    p = s["_p"]
    groups = q.get("required_any") or []
    boost = q.get("boost_practical") or []
    reject = q.get("reject_if") or []
    prefer_title = q.get("prefer_title") or []

    matched_groups = 0
    reasons = []
    title_hit = False
    practical_hit = False

    for group in groups:
        ok = False
        for phrase in group:
            if contains(p["body"], phrase) or contains(p["all"], phrase):
                ok = True
                reasons.append(f"matched:{phrase}")
                if contains(p["topic"], phrase) or contains(p["title"], phrase):
                    title_hit = True
                break
        if ok:
            matched_groups += 1

    if matched_groups == 0:
        return None

    # Must match all groups for strong; allow partial with lower score
    full = matched_groups == len(groups) if groups else False
    score = matched_groups * (3.0 if full else 1.4)

    for phrase in prefer_title:
        if contains(p["topic"], phrase) or contains(p["title"], phrase):
            score += 3.5
            title_hit = True
            reasons.append(f"title_pref:{phrase}")

    for phrase in boost:
        if contains(p["practical"], phrase):
            score += 2.0
            practical_hit = True
            reasons.append(f"practical:{phrase}")

    # reject false friends when title doesn't support
    if reject and not title_hit:
        if any(contains(p["body"], r) for r in reject) and score < 6:
            return None

    # penalties
    if s["_focus"] >= 25 and not title_hit:
        score *= 0.4
        reasons.append("penalty:focus_dump_no_title")
    elif s["_focus"] >= 25 and title_hit:
        score *= 0.85
        reasons.append("soft_penalty:focus_dump_but_title")

    if s["week"] in LATE_WEEKS and not title_hit:
        score *= 0.35
        reasons.append("penalty:late_week")
    elif s["block"] == 10 and not title_hit:
        score *= 0.5
        reasons.append("penalty:block10")

    # earliest teaching small bonus for equal quality
    if s["week"] <= 30:
        score += 0.4
    if s["block"] == 1 and title_hit:
        score += 0.6
        reasons.append("foundation_title_match")

    if score < 2.5:
        return None

    snip = as_text(s.get("topic"))
    pract = s.get("activities") or {}
    if isinstance(pract, dict) and pract.get("practical"):
        first = pract["practical"][0]
        if isinstance(first, dict):
            snip = f"{snip} | Practical: {(first.get('activity') or '')[:160]}"

    return Hit(
        week=s["week"],
        block=s["block"],
        topic=s.get("topic") or s.get("title") or "",
        score=round(score, 2),
        reasons=reasons[:14],
        snippets=[snip[:280]],
        title_hit=title_hit,
        practical_hit=practical_hit,
    )


def analyse(q: dict, min_high=7.0, min_med=4.8) -> dict:
    hits = []
    for s in SESSIONS:
        h = score_session(s, q)
        if h:
            hits.append(h)
    hits.sort(key=lambda h: (-h.score, h.week))
    if not hits:
        return {
            "classification": "CURRICULUM_GAP",
            "confidence": "LOW",
            "confidenceScore": 0,
            "proposedPrimaryBlock": None,
            "reinforcementBlocks": [],
            "topHits": [],
        }

    # best per block
    by_block: dict[int, Hit] = {}
    for h in hits:
        if h.block not in by_block or h.score > by_block[h.block].score:
            by_block[h.block] = h
    ranked = sorted(by_block.values(), key=lambda h: (-h.score, h.week))
    best_score = ranked[0].score

    # Prefer earliest title_hit among near-top scores (human Primaries often pick first substantial teaching)
    title_contenders = [h for h in ranked if h.title_hit and h.score >= best_score * 0.78]
    if title_contenders:
        top = sorted(title_contenders, key=lambda h: (h.week, -h.score))[0]
    else:
        contenders = [
            h
            for h in ranked
            if h.score >= best_score * 0.88 and (h.title_hit or h.practical_hit or h.score >= min_high)
        ]
        if not contenders:
            contenders = ranked[:2]
        top = sorted(contenders, key=lambda h: (h.week, -h.score))[0]
        for h in contenders:
            if h.score >= top.score + 2.5 and h.title_hit:
                top = h
                break

    others = [h for h in ranked if h.block != top.block]
    second = others[0] if others else None

    # Ambiguous only if another block is close, title-strong, and not merely later reinforcement
    if (
        second
        and second.title_hit
        and second.score >= top.score * 0.95
        and second.score >= min_med
        and second.week < top.week  # earlier rival exists
    ):
        return {
            "classification": "AMBIGUOUS",
            "confidence": "MEDIUM",
            "confidenceScore": top.score,
            "proposedPrimaryBlock": None,
            "candidateBlocks": [
                {"block": second.block, "score": second.score, "week": second.week, "topic": second.topic, "titleHit": second.title_hit},
                {"block": top.block, "score": top.score, "week": top.week, "topic": top.topic, "titleHit": top.title_hit},
            ],
            "reinforcementBlocks": [h.block for h in others[1:4]],
            "topHits": [asdict(h) for h in hits[:6]],
            "questionHint": f"Choose Primary between earlier B{second.block} (W{second.week}) and B{top.block} (W{top.week}).",
        }
    if (
        second
        and second.title_hit
        and top.title_hit
        and abs(second.score - top.score) <= 0.8
        and second.block != top.block
        and min(second.week, top.week) > 0
    ):
        # two different early/specialist homes nearly tied
        earlier, later = (top, second) if top.week <= second.week else (second, top)
        if later.week - earlier.week <= 25 and earlier.score >= min_med:
            return {
                "classification": "AMBIGUOUS",
                "confidence": "MEDIUM",
                "confidenceScore": max(top.score, second.score),
                "proposedPrimaryBlock": None,
                "candidateBlocks": [
                    {"block": earlier.block, "score": earlier.score, "week": earlier.week, "topic": earlier.topic, "titleHit": earlier.title_hit},
                    {"block": later.block, "score": later.score, "week": later.week, "topic": later.topic, "titleHit": later.title_hit},
                ],
                "topHits": [asdict(h) for h in hits[:6]],
                "questionHint": f"Choose Primary between B{earlier.block} (W{earlier.week}) and B{later.block} (W{later.week}).",
            }

    if top.score >= min_high and (top.title_hit or top.practical_hit):
        cls, conf = "HIGH_CONFIDENCE_PRIMARY", "HIGH"
    elif top.score >= min_med:
        cls, conf = "MEDIUM_CONFIDENCE_PRIMARY", "MEDIUM"
    else:
        return {
            "classification": "CURRICULUM_GAP" if top.score < 3.5 else "AMBIGUOUS",
            "confidence": "LOW",
            "confidenceScore": top.score,
            "proposedPrimaryBlock": None,
            "candidateBlocks": [
                {"block": h.block, "score": h.score, "week": h.week, "topic": h.topic}
                for h in ranked[:3]
            ],
            "topHits": [asdict(h) for h in hits[:5]],
        }

    return {
        "classification": cls,
        "confidence": conf,
        "confidenceScore": top.score,
        "proposedPrimaryBlock": top.block,
        "proposedPrimaryWeek": top.week,
        "proposedPrimaryTopic": top.topic,
        "reinforcementBlocks": [h.block for h in others if h.score >= min_med * 0.9][:4],
        "topHits": [asdict(h) for h in hits[:6]],
        "bestEvidenceSummary": top.snippets[0] if top.snippets else top.topic,
        "evidenceReasons": top.reasons,
        "titleHit": top.title_hit,
        "practicalHit": top.practical_hit,
    }


QUERIES = {
    "K3": {"required_any": [["health and safety", "coshh", "ppe", "puwer", "loler", "manual handling", "hazard"]], "prefer_title": ["safety", "hazard", "health"], "boost_practical": ["hazard", "ppe", "safety"]},
    "K4": {"required_any": [["environment", "sustainability", "recycling", "waste", "spill"]], "prefer_title": ["environment", "waste", "spill"], "boost_practical": ["spill", "waste", "recycling"]},
    "K5": {"required_any": [["tool", "equipment"]], "prefer_title": ["tool", "equipment"], "boost_practical": ["tool", "equipment"]},
    "K6": {"required_any": [["calibration", "tool control", "storage", "return tools", "maintain"]], "prefer_title": ["tool"], "boost_practical": ["calibration", "tool control", "store"]},
    "K8": {"required_any": [["service record", "warranty", "owner", "job card", "documentation", "manual"]], "prefer_title": ["documentation", "job-card", "warranty", "record"], "boost_practical": ["job card", "documentation", "warranty"]},
    "K9": {"required_any": [["tyre", "tpms", "sidewall"]], "prefer_title": ["tyre", "tpms"], "boost_practical": ["tyre", "tpms", "sidewall"], "reject_if": ["geometry correlation"]},
    "K10": {"required_any": [["steering"]], "prefer_title": ["steering"], "boost_practical": ["steering"], "reject_if": ["pre-calibration"]},
    "K11": {"required_any": [["suspension"]], "prefer_title": ["suspension"], "boost_practical": ["suspension", "replace"]},
    "K14": {"required_any": [["air-conditioning", "air conditioning", "climate-control", "climate control", "hvac", "refrigerant"]], "prefer_title": ["air-conditioning", "climate", "hvac"], "boost_practical": ["climate", "air-conditioning", "air conditioning"]},
    "K15": {"required_any": [["alternator", "starter", "charging system", "starting and charging", "12v", "low voltage", "auxiliary battery"]], "prefer_title": ["electrical", "charging", "battery"], "boost_practical": ["battery", "charging", "starter", "alternator"], "reject_if": ["high voltage", "ev service", "fire safety"]},
    "K16": {"required_any": [["battery"], ["replace", "replacement", "maintain", "maintenance", "charging", "alternator", "starter"]], "prefer_title": ["electrical", "battery", "charging"], "boost_practical": ["replace", "battery", "charging"], "reject_if": ["high voltage", "fire safety"]},
    "K17": {"required_any": [["adas", "driver assistance", "driver-assistance", "calibration", "pre-calibration", "sensor"]], "prefer_title": ["calibration", "adas", "sensor", "pre-calibration"], "boost_practical": ["calibration", "sensor"]},
    "K19": {"required_any": [["wheel alignment", "geometry", "toe", "camber", "thrust angle", "ackermann"]], "prefer_title": ["alignment", "geometry", "wheel alignment"], "boost_practical": ["alignment", "geometry", "toe"], "reject_if": ["correlation"]},
    "K22": {"required_any": [["hydrogen"]], "prefer_title": ["hydrogen"], "boost_practical": ["hydrogen", "fuel cell"]},
    "K25": {"required_any": [["business", "competitiveness", "efficiency", "customer satisfaction", "ethical"]], "prefer_title": ["business", "commercial"]},
    "K26": {"required_any": [["parts", "procurement", "catalogue", "costing", "supplier"]], "prefer_title": ["parts", "supplier", "catalogue"], "boost_practical": ["parts", "catalogue", "order"]},
    "K27": {"required_any": [["stock", "inventory", "stock rotation", "goods-in", "parts storage"]], "prefer_title": ["stock", "inventory", "goods-in"], "boost_practical": ["stock", "inventory", "rotation"]},
    "K28": {"required_any": [["fca", "financial conduct", "pci", "payment card"]], "prefer_title": ["fca", "pci", "payment", "financial"]},
    "K32": {"required_any": [["communication", "verbal", "customer update", "explain", "handover", "first impressions"]], "prefer_title": ["communication", "customer", "handover", "adviser"], "boost_practical": ["role-play", "customer", "communicate"]},
    "K33": {"required_any": [["written", "job card", "documentation", "terminology", "record"]], "prefer_title": ["documentation", "job-card", "record", "portfolio"], "boost_practical": ["job card", "documentation", "write"]},
    "S5": {"required_any": [["technical data", "vehicle data", "vin", "tolerances", "specifications", "manufacturer data"]], "prefer_title": ["technical data", "vin", "measurement", "tolerances"], "boost_practical": ["vin", "data", "lookup", "tolerances"], "reject_if": ["gdpr", "cyber"]},
    "S6": {"required_any": [["environmental", "sustainability", "recycling", "segregat", "spill", "waste"]], "prefer_title": ["environment", "waste", "spill"], "boost_practical": ["spill", "waste", "segregat"]},
    "S8": {"required_any": [["tools", "equipment", "multimeter", "measuring", "diagnostic equipment"]], "prefer_title": ["tool", "multimeter", "measurement", "diagnostic"], "boost_practical": ["tool", "measure", "multimeter"]},
    "S9": {"required_any": [["tyre"], ["balance", "remove", "replace", "repair", "wheel assembl"]], "prefer_title": ["tyre"], "boost_practical": ["tyre", "balance", "replace"], "reject_if": ["geometry"]},
    "S10": {"required_any": [["remove", "replace"], ["steering", "suspension", "brak", "air conditioning", "battery", "emission", "filter"]], "prefer_title": ["replace", "suspension", "brake", "repair"], "boost_practical": ["replace", "remove"]},
    "S16": {"required_any": [["quotation", "quote", "estimate"], ["parts", "cost", "authorisation", "authorization", "order"]], "prefer_title": ["quote", "estimate", "quotation"], "boost_practical": ["quote", "estimate", "order"]},
    "S17": {"required_any": [["stock", "parts storage", "stock rotation", "goods-in", "inventory"]], "prefer_title": ["stock", "inventory", "goods-in"], "boost_practical": ["stock", "rotation", "storage"]},
    "S18": {"required_any": [["sales process", "features and benefits", "consultative", "upsell", "mini closing"]], "prefer_title": ["sales", "upsell", "quotation"], "boost_practical": ["sales", "upsell", "features"]},
    "S21": {"required_any": [["communicate", "customer", "verbal", "handover", "colleagues"]], "prefer_title": ["customer", "communication", "handover", "adviser"], "boost_practical": ["customer", "communicate", "role-play"]},
    "S22": {"required_any": [["written", "job card", "documentation", "writing", "record"]], "prefer_title": ["documentation", "record", "job-card"], "boost_practical": ["documentation", "job card", "write"]},
    "S24": {"required_any": [["learning and development", "cpd", "reflective", "portfolio", "developmental"]], "prefer_title": ["portfolio", "reflective", "development", "cpd"], "boost_practical": ["portfolio", "reflective"]},
    "B1": {"required_any": [["health and safety", "safe working", "safety expectations", "hazard"]], "prefer_title": ["safety", "hazard", "health"], "boost_practical": ["safety", "hazard", "ppe"]},
    "B2": {"required_any": [["environment", "sustainability", "waste", "recycling"]], "prefer_title": ["environment", "waste", "spill"], "boost_practical": ["environment", "waste", "spill"]},
    "B3": {"required_any": [["adapt", "changing work", "time management", "prioritis", "task sequencing", "workload"]], "prefer_title": ["time management", "productivity", "sequencing", "prioritis"], "boost_practical": ["sequencing", "time management", "prioritis"]},
    "B4": {"required_any": [["learning and development", "cpd", "professional development", "reflective", "developmental"]], "prefer_title": ["portfolio", "reflective", "development"], "boost_practical": ["portfolio", "reflective"]},
}

GOLDEN_Q = {
    "K12": {"required_any": [["brake"]], "prefer_title": ["brake"], "boost_practical": ["brake"]},
    "K24": {"required_any": [["customer"], ["service", "dispute", "complaint", "challenging"]], "prefer_title": ["customer"], "boost_practical": ["customer", "scenario"]},
    "S12": {"required_any": [["alignment", "geometry", "wheel alignment"]], "prefer_title": ["alignment", "geometry", "wheel alignment"], "boost_practical": ["alignment"], "reject_if": ["correlation"]},
    "S15": {"required_any": [["customer"]], "prefer_title": ["customer"], "boost_practical": ["customer", "scenario"]},
    "K29": {"required_any": [["sales", "estimate", "quotation", "authorisation", "authorization"]], "prefer_title": ["estimate", "quotation", "sales", "authorisation"], "boost_practical": ["estimate", "quote"]},
    "K30": {"required_any": [["team", "handoff", "handover", "bay discipline", "delegation"]], "prefer_title": ["team", "handoff", "handover", "bay", "discipline"], "boost_practical": ["team", "handover"], "reject_if": ["specialist transition"]},
    "S1": {"required_any": [["health and safety", "ppe", "safe"]], "prefer_title": ["housekeeping", "5s", "safe storage", "safety"], "boost_practical": ["safe", "ppe", "housekeeping"]},
    "S2": {"required_any": [["prepare", "work area", "housekeeping", "slip", "trip", "safe storage"]], "prefer_title": ["housekeeping", "safe storage", "5s"], "boost_practical": ["housekeeping", "area", "storage"], "reject_if": ["occupational expectations"]},
    "S3": {"required_any": [["housekeeping", "5s", "restore", "tidy", "work area"]], "prefer_title": ["housekeeping", "5s"], "boost_practical": ["housekeeping", "5s"]},
    "S19": {"required_any": [["team", "handoff", "handover", "delegation", "bay"]], "prefer_title": ["team", "handoff", "handover", "bay"], "boost_practical": ["team", "handover"], "reject_if": ["specialist transition"]},
    "S4": {"required_any": [["tool control", "calibration", "store", "return tools"]], "prefer_title": ["tool"], "boost_practical": ["tool", "calibration"]},
    "K21": {"required_any": [["ev", "electrified", "electric vehicle", "charging"]], "prefer_title": ["ev", "electrified", "charging"], "boost_practical": ["ev", "charging"], "reject_if": ["state-of-health", "hybrid and high-voltage vehicle awareness"]},
    "K23": {"required_any": [["high voltage", "isolation", "electrified"]], "prefer_title": ["ev", "electrified", "isolation", "charging and safety"], "boost_practical": ["isolation", "hv", "electrified"], "reject_if": ["fire safety", "basic electrical", "hybrid and high-voltage vehicle awareness"]},
    "S13": {"required_any": [["isolate", "isolation"], ["electrified", "high voltage", "ev"]], "prefer_title": ["ev", "isolation", "electrified", "charging and safety"], "boost_practical": ["isolate", "isolation"], "reject_if": ["fire safety", "basic electrical", "hybrid and high-voltage vehicle awareness"]},
    "S14": {"required_any": [["record keeping", "compliance", "audit", "documentation"]], "prefer_title": ["record", "documentation", "audit", "compliance"], "boost_practical": ["record", "documentation", "audit"], "reject_if": ["stock auditing"]},
}

GAP_Q = {
    "K1": {"required_any": [["limits of autonomy", "reporting channels", "role of the autocare", "autocare technician role", "automotive industry and the role"]], "prefer_title": ["role", "autonomy"]},
    "K2": {"required_any": [["manufacturer", "approved schedule", "service schedule", "wear and serviceability", "vehicle specific data"]], "prefer_title": ["schedule", "manufacturer"]},
    "S7": {"required_any": [["routine maintenance", "safety inspection"], ["vehicle specific", "manufacturer", "schedule"]], "prefer_title": ["inspection", "maintenance", "schedule"]},
    "K7": {"required_any": [["workplace instructions", "workplace instruction"]], "prefer_title": ["workplace instructions"]},
    "K13": {"required_any": [["emission", "catalytic", "diesel particulate", "exhaust gas recirculation", "selective catalyst", "evaporative control"]], "prefer_title": ["emission"]},
    "K18": {"required_any": [["levels of autonomy", "passive and active"]], "prefer_title": ["autonomy"]},
    "K20": {"required_any": [["brake fluid", "oil filter", "air filter", "filtration systems"]], "prefer_title": ["fluid", "filter", "filtration"]},
    "S25": {"required_any": [["brake fluid", "oil filter", "air filter"], ["replace"]], "prefer_title": ["fluid", "filter"]},
    "K31": {"required_any": [["equity", "diversity", "inclusion"]], "prefer_title": ["inclusion", "diversity", "equity"]},
    "S20": {"required_any": [["equity", "diversity", "inclusion"]], "prefer_title": ["inclusion", "diversity"]},
    "B5": {"required_any": [["inclusive", "diversity", "inclusion", "respectful of different"]], "prefer_title": ["inclusive", "diversity"]},
    "K34": {"required_any": [["gdpr", "cyber security", "cyber"]], "prefer_title": ["gdpr", "cyber", "digital"]},
    "S23": {"required_any": [["gdpr", "cyber"]], "prefer_title": ["gdpr", "cyber", "digital"]},
    "S11": {"required_any": [["state-of-health", "state of health", "soh"]], "prefer_title": ["state-of-health", "soh"]},
}


def _session_by_week(week: int) -> dict | None:
    return next((s for s in SESSIONS if s["week"] == week), None)


def _demote_to_ambiguous(out: dict, reason: str, candidates: list[dict], question: str) -> dict:
    out["classification"] = "AMBIGUOUS"
    out["confidence"] = "MEDIUM"
    out["ambiguityReason"] = reason
    out["questionHint"] = question
    out["candidateBlocks"] = candidates
    out["proposedPrimaryBlock"] = None
    out["proposedPrimaryWeek"] = None
    out["proposedPrimaryTopic"] = None
    out.pop("proposedPrimaryBlockTitle", None)
    out.pop("reinforcementBlocks", None)
    return out


def package(code: str, a: dict) -> dict:
    d = DEFS[code]
    out = {"ksbCode": code, "officialRequirement": d["statement"], "ksbType": d["type"], **a}
    if a.get("proposedPrimaryBlock"):
        b = a["proposedPrimaryBlock"]
        out["proposedPrimaryBlockTitle"] = BLOCK_TITLES[b]
        out["sourceDocument"] = "Autocare_L2_Lesson_Plans_v1.0 (original untouched)"
        out["sourceVersion"] = "v1.0"
        out["week"] = a.get("proposedPrimaryWeek")
        out["file"] = next((s["file"] for s in SESSIONS if s["week"] == a.get("proposedPrimaryWeek")), None)

    # S10 special — multi-system skill needs coverage decomposition
    if code == "S10" and a.get("classification") in {"HIGH_CONFIDENCE_PRIMARY", "MEDIUM_CONFIDENCE_PRIMARY"}:
        bodies = " ".join(s["_p"]["body"] for s in SESSIONS if s["block"] == a["proposedPrimaryBlock"])
        missing = []
        for label, keys in {
            "steering": ["steering"],
            "suspension": ["suspension"],
            "braking": ["brak"],
            "emission": ["emission", "dpf", "catalytic"],
            "hvac": ["air conditioning", "air-conditioning", "climate"],
            "battery_charging": ["battery", "charging"],
            "fluid_filtration": ["oil filter", "air filter", "filtration", "brake fluid"],
        }.items():
            if not any(k in bodies for k in keys):
                missing.append(label)
        if missing:
            return _demote_to_ambiguous(
                out,
                "S10 requires inspect/remove/replace across multiple systems; proposed block evidence missing: "
                + ", ".join(missing),
                [
                    {
                        "block": a.get("proposedPrimaryBlock"),
                        "week": a.get("proposedPrimaryWeek"),
                        "topic": a.get("proposedPrimaryTopic"),
                        "note": "partial system coverage only",
                    }
                ],
                "Should S10 Primary be a multi-block system family (no single Primary), or assigned to the strongest remove/replace block with Reinforcements elsewhere?",
            )

    # Quality gates — prevent auto-HIGH on known false-friend / awareness-only patterns
    topic = (a.get("proposedPrimaryTopic") or "").lower()
    week = a.get("proposedPrimaryWeek")
    cls = out.get("classification")

    if code in {"K15", "K16"} and cls in {"HIGH_CONFIDENCE_PRIMARY", "MEDIUM_CONFIDENCE_PRIMARY"}:
        # B1 fire/battery awareness is introductory; specialist Electrical System Inspection is denser Autocare home
        if week == 4 or "fire safety" in topic or "battery awareness" in topic or "hybrid and high-voltage vehicle awareness" in topic:
            w12 = _session_by_week(12)
            return _demote_to_ambiguous(
                out,
                "Top hit is foundation awareness (Fire Safety / Battery Awareness), not substantive LV starter/alternator/charging teaching.",
                [
                    {"block": 1, "week": 4, "topic": "Fire Safety, Battery Awareness and Basic Electrical Safety", "role": "awareness / introduction"},
                    {
                        "block": w12["block"] if w12 else 2,
                        "week": 12,
                        "topic": (w12 or {}).get("topic") or "Electrical System Inspection",
                        "role": "first specialist electrical inspection teaching",
                    },
                ],
                f"For {code}, is Primary Block 1 (foundation battery/electrical awareness W04) or Block 2 (Electrical System Inspection W12)?",
            )

    if code == "S9" and cls in {"HIGH_CONFIDENCE_PRIMARY", "MEDIUM_CONFIDENCE_PRIMARY"}:
        # TPMS-only week does not prove remove/repair/replace/balance tyre assembly
        if "tpms" in topic or "pressure monitoring" in topic:
            tyre_weeks = [
                s
                for s in SESSIONS
                if any(k in (s.get("topic") or "").lower() for k in ("tyre", "tire"))
                and "alignment" not in (s.get("topic") or "").lower()
                and "geometry" not in (s.get("topic") or "").lower()
            ]
            return _demote_to_ambiguous(
                out,
                "Official S9 requires remove, repair, replace and balance tyres/wheels; top hit is TPMS-focused and does not prove full tyre assembly skill.",
                [{"block": a.get("proposedPrimaryBlock"), "week": week, "topic": a.get("proposedPrimaryTopic"), "role": "TPMS knowledge/skill component only"}]
                + [
                    {"block": s["block"], "week": s["week"], "topic": s.get("topic"), "role": "tyre-related candidate"}
                    for s in tyre_weeks
                    if s["week"] != week
                ][:4],
                "For S9, which week is the Primary tyre remove/repair/replace/balance teaching home? (TPMS alone is insufficient; W106 is late consolidation.)",
            )

    if code in {"K32", "S21"} and cls == "AMBIGUOUS":
        out["questionHint"] = (
            "Customer/verbal communication appears in both Diagnostic complex repair (B5) and Advanced workshop communication (B7). "
            "Which block is the deliberate Primary teaching home for customer updates/handover communication?"
        )

    if code == "K8" and cls == "AMBIGUOUS":
        out["questionHint"] = (
            "Technical documentation/service literature appears in Foundation transition (B1 W10) and workshop process weeks (B3). "
            "Is Primary the first Foundation documentation teaching, or the specialist Autocare job-card/warranty application week?"
        )

    if code == "S16" and cls == "AMBIGUOUS":
        out["questionHint"] = (
            "Quotation/parts ordering evidence splits between Workshop Processes (B3) and Emerging Technology/driveline commercial practice (B4). "
            "Which is Primary for creating estimates/quotations and progressing parts?"
        )

    # Medium-confidence candidates require human judgment before Primary approval
    if out.get("classification") == "MEDIUM_CONFIDENCE_PRIMARY":
        b = out.get("proposedPrimaryBlock")
        return _demote_to_ambiguous(
            out,
            "Evidence exists but is not strong enough for automatic Primary recommendation (MEDIUM).",
            [
                {
                    "block": b,
                    "week": a.get("proposedPrimaryWeek"),
                    "topic": a.get("proposedPrimaryTopic"),
                    "score": a.get("confidenceScore"),
                    "role": "best automatic candidate",
                }
            ]
            + (a.get("candidateBlocks") or [])[:2],
            f"Accept proposed Primary B{b} for {code}, choose an alternate block, or mark as curriculum gap?",
        )

    return out


def main():
    assert VERIFY["match"]
    results = [package(code, analyse(QUERIES[code])) for code in UNRESOLVED]

    golden_p = []
    for code, exp in GOLDEN_PRIMARIES.items():
        a = analyse(GOLDEN_Q[code])
        pred = a.get("proposedPrimaryBlock")
        status = "reproduced" if pred == exp else ("ambiguous" if a.get("classification") == "AMBIGUOUS" else "disagreed")
        golden_p.append({"ksbCode": code, "humanApprovedPrimary": exp, "analyserPredictedPrimary": pred, "analyserClassification": a.get("classification"), "analyserScore": a.get("confidenceScore"), "status": status, "top": a.get("proposedPrimaryTopic") or a.get("candidateBlocks")})

    golden_g = []
    for code in sorted(GOLDEN_GAPS):
        a = analyse(GAP_Q[code], min_high=8.5, min_med=6.0)
        cls = a.get("classification")
        if cls == "CURRICULUM_GAP":
            status = "reproduced_as_gap"
        elif cls == "AMBIGUOUS":
            status = "ambiguous"
        else:
            status = "disagreed_covered"
        golden_g.append({"ksbCode": code, "analyserClassification": cls, "analyserPredictedPrimary": a.get("proposedPrimaryBlock"), "analyserScore": a.get("confidenceScore"), "status": status, "topic": a.get("proposedPrimaryTopic")})

    high = [r for r in results if r.get("classification") == "HIGH_CONFIDENCE_PRIMARY"]
    medium = [r for r in results if r.get("classification") == "MEDIUM_CONFIDENCE_PRIMARY"]
    amb = [r for r in results if r.get("classification") == "AMBIGUOUS"]
    gaps = [r for r in results if r.get("classification") == "CURRICULUM_GAP"]

    report = {
        "status": "REVIEW_ONLY",
        "programmeVersionId": "231a8a32-d876-4312-a178-960d19dcf938",
        "analyserVersion": "v2.1-title-practical-quality-gates",
        "title": "Autocare V1 AI Baseline Analysis (prototype evaluation)",
        "rules": {
            "evidencePack": "Autocare_L2_Lesson_Plans_v1.0 original only",
            "excludedAsEvidence": ["AI Proposed Amendments", "AUTOCARE_* static", "focusLine-only", "Gateway/EPA"],
            "notPersisted": True,
        },
        "A_currentStateVerification": {
            "official": 64,
            "approvedPrimaries": 15,
            "reviewedGaps": 14,
            "unresolved": 35,
            "listMatchExpected35": True,
            "unresolvedCodes": UNRESOLVED,
        },
        "B_goldenSetAccuracy": {
            "existing15Primaries": {
                "reproduced": sum(1 for g in golden_p if g["status"] == "reproduced"),
                "ambiguous": sum(1 for g in golden_p if g["status"] == "ambiguous"),
                "disagreed": sum(1 for g in golden_p if g["status"] == "disagreed"),
                "detail": golden_p,
            },
            "existing14Gaps": {
                "reproducedAsGaps": sum(1 for g in golden_g if g["status"] == "reproduced_as_gap"),
                "ambiguous": sum(1 for g in golden_g if g["status"] == "ambiguous"),
                "disagreedCovered": sum(1 for g in golden_g if g["status"] == "disagreed_covered"),
                "detail": golden_g,
            },
        },
        "C_highConfidencePrimaryCandidates": high,
        "C2_mediumConfidencePrimaryCandidates": medium,
        "D_humanReviewRequired": amb,
        "E_newCurriculumGaps": gaps,
        "F_predictedFinalCoverage": {
            "existingApprovedPrimaries": 15,
            "newHighConfidenceCandidates": len(high),
            "newMediumConfidenceCandidates": 0,
            "noteMediumPolicy": "MEDIUM-confidence candidates are routed to human review (not auto-Primary).",
            "existingReviewedGaps": 14,
            "newGaps": len(gaps),
            "humanDecisionsRemaining": len(amb),
            "totalAccountedFor": 15 + len(high) + 14 + len(gaps) + len(amb),
            "identityCheck": "15 approved + high + 14 reviewed gaps + new gaps + human = 64",
        },
        "embeddedAiImplementationLearnings": [
            "Specialist lesson aims are heavily templated; topic title + practical/application text are the discriminative evidence channels.",
            "focusLine KSB dumps must be ignored or heavily penalised — they create false multi-block coverage.",
            "False substring matches (e.g. 'egr' inside 'segregation', 'closing' inside unrelated phrases) require word-boundary matching.",
            "Knowledge vs Skill Primaries can legitimately diverge (e.g. H&S knowledge in B1 FS vs H&S skill practice in B3) — coherence rules must allow K/S split.",
            "Multi-system Skills (S10) need system-coverage decomposition; a single week title rarely proves full official scope.",
            "Late consolidation weeks (100+) imitate coverage; Primary selection must prefer first substantial teaching with practical evidence.",
            "Block 1 Foundation has no Autocare KSB codes — semantic linking is mandatory and will be a first-class portal capability.",
            "Source packs lack stable content hashes/session IDs — needed for future delta analysis between programme versions.",
            "Stock 'Develop secure occupational knowledge…' aims collapse distinct lessons into near-duplicates for bag-of-words models.",
            "Human golden Primaries often select earliest specialist practice rather than absolute keyword maximum — 'earliest among near-top title/practical hits' approximates this.",
        ],
        "all35Detail": results,
    }
    out = ROOT / ".tmp-autocare-v1-ai-baseline-analysis.json"
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "saved": str(out),
        "high": len(high),
        "medium": len(medium),
        "ambiguous": len(amb),
        "newGaps": len(gaps),
        "goldenPrimary": report["B_goldenSetAccuracy"]["existing15Primaries"],
        "goldenGaps": {k: report["B_goldenSetAccuracy"]["existing14Gaps"][k] for k in ("reproducedAsGaps","ambiguous","disagreedCovered")},
        "highList": [(h["ksbCode"], h["proposedPrimaryBlock"], h.get("proposedPrimaryWeek"), h.get("proposedPrimaryTopic")) for h in high],
        "medList": [(h["ksbCode"], h["proposedPrimaryBlock"], h.get("proposedPrimaryTopic")) for h in medium],
        "gapList": [h["ksbCode"] for h in gaps],
        "ambList": [(h["ksbCode"], h.get("questionHint") or h.get("ambiguityReason") or h.get("candidateBlocks")) for h in amb],
        "goldenPdetail": [(g["ksbCode"], g["status"], g["humanApprovedPrimary"], g["analyserPredictedPrimary"]) for g in golden_p],
        "goldenGdetail": [(g["ksbCode"], g["status"], g.get("analyserPredictedPrimary"), g.get("topic")) for g in golden_g],
    }, indent=2, default=str))


if __name__ == "__main__":
    main()
