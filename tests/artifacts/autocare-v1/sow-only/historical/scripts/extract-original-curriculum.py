# -*- coding: utf-8 -*-
"""Extract structured teaching content from original Autocare L2 lesson plans."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from docx import Document
from docx.table import Table

ROOT = Path(
    r"C:\Users\Reiss\Desktop\Portal Questions\AutoCare L2"
    r"\Autocare_L2_Lesson_Plans\Autocare_L2_Lesson_Plans_v1.0"
)
FOUNDATION_DIR = ROOT / "01_Shared_Foundation_Skills_FS01-FS10_v1.0"
SPECIALIST_DIR = ROOT / "02_Specialist_Lesson_Plans"
INDEX_CSV = ROOT / "Autocare_L2_Lesson_Plan_Index_v1.0.csv"
OUT_CORPUS = Path(r"D:\GTA Portal\.tmp-original-curriculum-corpus.json")
OUT_INDEX = Path(r"D:\GTA Portal\.tmp-original-curriculum-corpus-index.json")

BULLET_CHARS = "\u2022\u2023\u25E6\u2043\u2219\u00B7•◦▪▫–-"


def norm_space(s: str) -> str:
    s = (s or "").replace("\xa0", " ").replace("\r", "\n")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def unique_cell_texts(row) -> list[str]:
    seen = set()
    out = []
    for cell in row.cells:
        t = norm_space(cell.text)
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def row_distinct_cols(row, n: int = 4) -> list[str]:
    distinct = []
    prev = None
    for cell in row.cells:
        t = norm_space(cell.text)
        if t != prev:
            distinct.append(t)
            prev = t
    while len(distinct) < n:
        distinct.append("")
    return distinct[:n]


def split_bullets(text: str) -> list[str]:
    text = norm_space(text)
    if not text:
        return []
    parts = re.split(
        r"(?:^|\n)\s*[{chars}]\s*".format(chars=re.escape(BULLET_CHARS)), text
    )
    items = [norm_space(p) for p in parts if norm_space(p)]
    refined = []
    for item in items:
        if " | " in item and any(c in item for c in BULLET_CHARS):
            for s in re.split(r"\s*\|\s*", item):
                s = norm_space(
                    re.sub(
                        r"^[{chars}]\s*".format(chars=re.escape(BULLET_CHARS)), "", s
                    )
                )
                if s:
                    refined.append(s)
        else:
            refined.append(item)
    if refined:
        refined[0] = re.sub(
            r"^(Lesson aims|Learning objectives.*?able to|How learning will be checked|"
            r"Simple impact measure)\s*[|\u2013\-:]*\s*",
            "",
            refined[0],
            flags=re.I,
        ).strip()
        refined[0] = re.sub(
            r"^[{chars}]\s*".format(chars=re.escape(BULLET_CHARS)), "", refined[0]
        ).strip()
    return [r for r in refined if r]


def field_value(text: str, label: str) -> str | None:
    m = re.match(
        re.escape(label) + r"\s*[|\u2013\-:]?\s*(.*)$",
        text,
        flags=re.I | re.S,
    )
    if m:
        return norm_space(m.group(1))
    return None


def full_plain_text(doc: Document, limit: int = 4000) -> str:
    chunks = []
    for p in doc.paragraphs:
        t = norm_space(p.text)
        if t:
            chunks.append(t)
    for table in doc.tables:
        for row in table.rows:
            cells = unique_cell_texts(row)
            if cells:
                chunks.append(" | ".join(cells))
    text = norm_space("\n".join(chunks))
    if len(text) > limit:
        return text[: limit - 1] + "…"
    return text


def parse_meta_table(table: Table) -> dict:
    meta = {
        "topic": None,
        "focusLine": None,
        "aims": [],
        "learningObjectives": [],
        "assessmentChecks": [],
        "impactMeasure": None,
        "occupationalRelevance": None,
        "sessionWeekLabel": None,
        "blockPeriod": None,
        "sowReference": None,
        "programme": None,
    }
    for row in table.rows:
        cells = unique_cell_texts(row)
        if not cells:
            continue
        joined = " | ".join(cells)

        for i, c in enumerate(cells):
            low = c.lower()
            if low == "topic" and i + 1 < len(cells):
                meta["topic"] = cells[i + 1]
            elif low == "duty / ksb focus" and i + 1 < len(cells):
                meta["focusLine"] = cells[i + 1]
            elif low.startswith("duty / ksb focus"):
                val = field_value(c, "Duty / KSB focus")
                if val:
                    meta["focusLine"] = val
                elif i + 1 < len(cells):
                    meta["focusLine"] = cells[i + 1]
            elif low == "block / period" and i + 1 < len(cells):
                meta["blockPeriod"] = cells[i + 1]
            elif low.startswith("block / period"):
                val = field_value(c, "Block / period")
                if val:
                    meta["blockPeriod"] = val
                elif i + 1 < len(cells):
                    meta["blockPeriod"] = cells[i + 1]
            elif low == "session / week" and i + 1 < len(cells):
                meta["sessionWeekLabel"] = cells[i + 1]
            elif low == "sow reference" and i + 1 < len(cells):
                meta["sowReference"] = cells[i + 1]
            elif low.startswith("programme") and i + 1 < len(cells):
                meta["programme"] = cells[i + 1]

        if joined.lower().startswith("occupational relevance"):
            meta["occupationalRelevance"] = joined

        if "lesson aims" in joined.lower() or "learning objectives" in joined.lower():
            for c in cells:
                cl = c.lower()
                if "lesson aims" in cl:
                    content = field_value(c, "Lesson aims") or c
                    content = re.sub(
                        r"^Lesson aims\s*[|\u2013\-:]*\s*", "", content, flags=re.I
                    )
                    meta["aims"] = split_bullets(content)
                if "learning objectives" in cl:
                    content = re.sub(
                        r"^Learning objectives.*?able to\s*[|\u2013\-:]*\s*",
                        "",
                        c,
                        flags=re.I,
                    )
                    meta["learningObjectives"] = split_bullets(content)

        if (
            "how learning will be checked" in joined.lower()
            or "simple impact measure" in joined.lower()
        ):
            for c in cells:
                cl = c.lower()
                if "how learning will be checked" in cl:
                    content = re.sub(
                        r"^How learning will be checked\s*[|\u2013\-:]*\s*",
                        "",
                        c,
                        flags=re.I,
                    )
                    meta["assessmentChecks"] = split_bullets(content)
                if "simple impact measure" in cl:
                    content = re.sub(
                        r"^Simple impact measure\s*[|\u2013\-:]*\s*",
                        "",
                        c,
                        flags=re.I,
                    )
                    meta["impactMeasure"] = norm_space(content)

    if not meta["focusLine"]:
        for row in table.rows:
            for c in unique_cell_texts(row):
                if re.search(r"Duty\s*\d+", c, re.I) and "ksb" in c.lower():
                    meta["focusLine"] = field_value(c, "Duty / KSB focus") or c
                    break
            if meta["focusLine"]:
                break

    return meta


def is_break_or_lunch(time_status: str) -> bool:
    ts = (time_status or "").lower()
    return "break" in ts or "lunch" in ts


def is_otj_slot(time_status: str) -> bool:
    ts = (time_status or "").lower()
    if is_break_or_lunch(ts):
        return False
    if "non-eligible" in ts or "non eligible" in ts:
        return False
    return "otj" in ts or bool(re.search(r"\d+\.\d+\s*otj", ts))


def parse_activity_table(table: Table) -> tuple[dict, list]:
    activities = {
        "theory": [],
        "practical": [],
        "application": [],
        "consolidation": [],
        "nonEligible": [],
        "workplaceFollowUp": [],
        "other": [],
    }
    assessment_evidence = []
    otj_slots = []

    for row in table.rows:
        uniq = unique_cell_texts(row)
        if not uniq:
            continue
        first = uniq[0].lower()
        if first.startswith("time / status"):
            continue

        if first.startswith("workplace follow-up") or "trainer preparation" in first:
            activities["workplaceFollowUp"].append(
                {
                    "timeStatus": "Workplace follow-up / trainer prep",
                    "activity": uniq[0],
                    "checks": uniq[1] if len(uniq) > 1 else "",
                    "resources": uniq[2] if len(uniq) > 2 else "",
                }
            )
            continue
        if first.startswith("post-lesson impact") or first.startswith("follow-up:"):
            activities["other"].append(
                {
                    "timeStatus": "Post-lesson / follow-up",
                    "activity": " | ".join(uniq),
                    "checks": "",
                    "resources": "",
                }
            )
            continue

        time_status, activity, checks, resources = row_distinct_cols(row, 4)
        entry = {
            "timeStatus": time_status,
            "activity": activity,
            "checks": checks,
            "resources": resources,
        }

        if is_break_or_lunch(time_status):
            continue

        ts_low = time_status.lower()
        if "non-eligible" in ts_low or "non eligible" in ts_low:
            activities["nonEligible"].append(entry)
            continue

        if is_otj_slot(time_status):
            otj_slots.append(entry)
            blob = f"{checks}\n{resources}\n{activity}"
            if re.search(
                r"evidence|assess|observation|record impact|portfolio|checklist",
                blob,
                re.I,
            ):
                assessment_evidence.append(
                    {
                        "timeStatus": time_status,
                        "text": norm_space(f"{checks} || {resources}"),
                    }
                )
            continue

        activities["other"].append(entry)

    # Template day structure: OTJ slots in order = theory, practical, application, consolidation
    bucket_names = ["theory", "practical", "application", "consolidation"]
    if len(otj_slots) <= 4:
        for i, entry in enumerate(otj_slots):
            activities[bucket_names[i]].append(entry)
    else:
        # First three + merge remainder into consolidation
        for i, entry in enumerate(otj_slots):
            if i < 3:
                activities[bucket_names[i]].append(entry)
            else:
                activities["consolidation"].append(entry)

    return activities, assessment_evidence


def extract_docx(path: Path, week: int, block: int | None) -> dict:
    doc = Document(str(path))
    title = None
    for p in doc.paragraphs:
        t = norm_space(p.text)
        if t:
            title = t
            break

    meta = {}
    activities = {
        "theory": [],
        "practical": [],
        "application": [],
        "consolidation": [],
        "nonEligible": [],
        "workplaceFollowUp": [],
        "other": [],
    }
    assessment_evidence = []

    if doc.tables:
        meta = parse_meta_table(doc.tables[0])
    if len(doc.tables) > 1:
        activities, assessment_evidence = parse_activity_table(doc.tables[1])

    assessment = {
        "howLearningChecked": meta.get("assessmentChecks") or [],
        "impactMeasure": meta.get("impactMeasure"),
        "evidenceFromActivities": assessment_evidence,
    }

    return {
        "week": week,
        "block": block,
        "file": path.name,
        "filePath": str(path),
        "title": title,
        "topic": meta.get("topic") or title,
        "focusLine": meta.get("focusLine"),
        "sessionWeekLabel": meta.get("sessionWeekLabel"),
        "blockPeriod": meta.get("blockPeriod"),
        "sowReference": meta.get("sowReference"),
        "programme": meta.get("programme"),
        "occupationalRelevance": meta.get("occupationalRelevance"),
        "aims": meta.get("aims") or [],
        "learningObjectives": meta.get("learningObjectives") or [],
        "activities": {
            "theory": activities.get("theory") or [],
            "practical": activities.get("practical") or [],
            "application": activities.get("application") or [],
            "consolidation": activities.get("consolidation") or [],
            "nonEligible": activities.get("nonEligible") or [],
            "workplaceFollowUp": activities.get("workplaceFollowUp") or [],
            "other": activities.get("other") or [],
        },
        "assessment": assessment,
        "fullTextTruncated": full_plain_text(doc, 4000),
    }


def load_week_block_map() -> dict[int, int]:
    mapping: dict[int, int] = {w: 1 for w in range(1, 11)}
    with INDEX_CSV.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            mapping[int(row["Week"])] = int(row["Block"])
    return mapping


def main() -> None:
    week_block = load_week_block_map()
    sessions = []
    errors = []

    for fp in sorted(FOUNDATION_DIR.glob("Foundation_Skills_FS*.docx")):
        m = re.search(r"Week_(\d+)", fp.name, re.I)
        if not m:
            errors.append({"file": fp.name, "error": "no week in filename"})
            continue
        week = int(m.group(1))
        try:
            sessions.append(extract_docx(fp, week, week_block.get(week, 1)))
        except Exception as e:
            errors.append({"file": fp.name, "error": str(e)})

    specialist_files = [
        p
        for p in sorted(SPECIALIST_DIR.rglob("*.docx"))
        if "proposed" not in str(p).lower() and "amendment" not in str(p).lower()
    ]
    for fp in specialist_files:
        m = re.search(r"Week_(\d+)", fp.name, re.I)
        if not m:
            errors.append({"file": fp.name, "error": "no week in filename"})
            continue
        week = int(m.group(1))
        block = week_block.get(week)
        try:
            rec = extract_docx(fp, week, block)
            if block is None:
                rec["blockNote"] = "missing from index CSV"
            sessions.append(rec)
        except Exception as e:
            errors.append({"file": fp.name, "error": str(e)})

    sessions.sort(key=lambda s: (s["week"] if s["week"] is not None else 9999, s["file"]))

    foundation_weeks = sorted({s["week"] for s in sessions if 1 <= s["week"] <= 10})
    specialist_weeks = sorted({s["week"] for s in sessions if s["week"] >= 11})
    expected_specialist = sorted(w for w in week_block if w >= 11)
    missing_foundation = [w for w in range(1, 11) if w not in foundation_weeks]
    missing_vs_index = [w for w in expected_specialist if w not in specialist_weeks]
    files_without_index = [w for w in specialist_weeks if w not in week_block]
    missing_in_range = []
    if specialist_weeks:
        missing_in_range = [
            w
            for w in range(min(specialist_weeks), max(specialist_weeks) + 1)
            if w not in specialist_weeks
        ]

    corpus = {
        "sourceRoot": str(ROOT),
        "indexCsv": str(INDEX_CSV),
        "extractedAtNote": "original pack only; AI Proposed Amendments excluded",
        "counts": {
            "foundationWeeks": len(foundation_weeks),
            "specialistWeeks": len(specialist_weeks),
            "totalSessions": len(sessions),
            "missingFoundationWeeks": missing_foundation,
            "missingSpecialistWeeksVsIndex": missing_vs_index,
            "missingSpecialistWeeksInFileRange": missing_in_range,
            "specialistFilesWithoutIndexBlock": files_without_index,
            "errors": errors,
        },
        "weekBlockMapFromIndex": {str(k): v for k, v in sorted(week_block.items())},
        "sessions": sessions,
    }

    index = [
        {
            "week": s["week"],
            "block": s["block"],
            "title": s.get("topic") or s.get("title"),
            "file": s["file"],
        }
        for s in sessions
    ]

    OUT_CORPUS.write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    # Coverage QA
    empty_aims = sum(1 for s in sessions if not s["aims"])
    empty_objs = sum(1 for s in sessions if not s["learningObjectives"])
    incomplete_acts = sum(
        1
        for s in sessions
        if not all(
            s["activities"][k]
            for k in ("theory", "practical", "application", "consolidation")
        )
    )
    focus_present = sum(1 for s in sessions if s.get("focusLine"))

    print("Foundation weeks:", len(foundation_weeks), foundation_weeks)
    print(
        "Specialist weeks:",
        len(specialist_weeks),
        f"({min(specialist_weeks)}-{max(specialist_weeks)})" if specialist_weeks else "",
    )
    print("Total sessions:", len(sessions))
    print("Missing foundation:", missing_foundation)
    print("Missing vs index:", missing_vs_index)
    print("Missing in file range:", missing_in_range)
    print("Files without index:", files_without_index)
    print("Errors:", len(errors))
    print("Empty aims:", empty_aims, "Empty objs:", empty_objs)
    print("Incomplete activity quartet:", incomplete_acts)
    print("focusLine present:", focus_present, "/", len(sessions))
    print("Wrote", OUT_CORPUS, OUT_CORPUS.stat().st_size)
    print("Wrote", OUT_INDEX, OUT_INDEX.stat().st_size)
    for w in (1, 11, 50, 113):
        s = next(x for x in sessions if x["week"] == w)
        print(
            f"QA w{w}: block={s['block']} topic={s['topic']!r} "
            f"focus={bool(s['focusLine'])} aims={len(s['aims'])} objs={len(s['learningObjectives'])} "
            f"T/P/A/C={len(s['activities']['theory'])}/{len(s['activities']['practical'])}/"
            f"{len(s['activities']['application'])}/{len(s['activities']['consolidation'])}"
        )


if __name__ == "__main__":
    main()
