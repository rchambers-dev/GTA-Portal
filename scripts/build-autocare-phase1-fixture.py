"""
Parse SOW v4.4 extract into Phase 1 fixture JSON.
Does not invent weeks — only emits what the SOW proves.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

SOW = Path(
    r"D:\GTA Portal\tests\artifacts\autocare-v1\evidence-enriched\staging"
    r"\extracts\res_sow_v4_4_e92d10f37f22.txt"
)
OUT = Path(
    r"D:\GTA Portal\data\curriculum-control\autocare-st0499-v1.3-phase1-fixture.json"
)

BLOCKS = [
    {
        "blockNumber": 1,
        "title": "Motor Vehicle Foundation Skills - Shared Controlled Programme",
        "itemType": "block",
        "weekStart": 1,
        "weekEnd": 10,
        "plannedOtjHours": 45.0,
        "plannedNonOtjHours": 15.0,
        "monthHint": "Months 1–3",
        "foundationSkills": True,
    },
    {
        "blockNumber": 2,
        "title": "Vehicle Inspection, Servicing and Customer Interaction",
        "itemType": "block",
        "weekStart": 11,
        "weekEnd": 20,
        "plannedOtjHours": 55.0,
        "plannedNonOtjHours": 5.0,
        "monthHint": "Months 3–5",
    },
    {
        "blockNumber": 3,
        "title": "Workshop Processes, Tools and Environmental Awareness",
        "itemType": "block",
        "weekStart": 21,
        "weekEnd": 30,
        "plannedOtjHours": 55.0,
        "plannedNonOtjHours": 5.0,
        "monthHint": "Months 5–8",
    },
    {
        "blockNumber": 4,
        "title": "Emerging Technology and Driveline Systems",
        "itemType": "block",
        "weekStart": 31,
        "weekEnd": 40,
        "plannedOtjHours": 55.0,
        "plannedNonOtjHours": 5.0,
        "monthHint": "Months 8–10",
    },
    {
        "blockNumber": 5,
        "title": "Diagnostic Thinking and Complex Repair Activities",
        "itemType": "block",
        "weekStart": 41,
        "weekEnd": 50,
        "plannedOtjHours": 55.0,
        "plannedNonOtjHours": 5.0,
        "monthHint": "Months 10–13",
    },
    {
        "blockNumber": 6,
        "title": "Vehicle Systems Integration and Advanced Diagnostics",
        "itemType": "block",
        "weekStart": 51,
        "weekEnd": 60,
        "plannedOtjHours": 55.0,
        "plannedNonOtjHours": 5.0,
        "monthHint": "Months 13–15",
    },
    {
        "blockNumber": 7,
        "title": "Advanced Workshop Practice and Technical Communication",
        "itemType": "block",
        "weekStart": 61,
        "weekEnd": 70,
        "plannedOtjHours": 55.0,
        "plannedNonOtjHours": 5.0,
        "monthHint": "Months 15–18",
    },
    {
        "blockNumber": 8,
        "title": "Advanced Diagnostics and Workshop Organisation",
        "itemType": "block",
        "weekStart": 71,
        "weekEnd": 80,
        "plannedOtjHours": 55.0,
        "plannedNonOtjHours": 5.0,
        "monthHint": "Months 18–20",
    },
    {
        "blockNumber": 9,
        "title": "Emerging Technologies, Electric Vehicles and Hydrogen Awareness",
        "itemType": "block",
        "weekStart": 81,
        "weekEnd": 94,
        "plannedOtjHours": 77.0,
        "plannedNonOtjHours": 7.0,
        "monthHint": "Months 20–24",
    },
    {
        "blockNumber": 10,
        "title": "Final Consolidation, Corrective Learning and EPA Readiness Training",
        "itemType": "block",
        "weekStart": 95,
        "weekEnd": 112,
        "plannedOtjHours": 104.5,
        "plannedNonOtjHours": 9.5,
        "monthHint": "Months 24–29",
    },
    {
        "blockNumber": 11,
        "title": "Gateway Readiness and Confirmation",
        "itemType": "gateway",
        "weekStart": None,
        "weekEnd": None,
        "plannedOtjHours": 0.0,
        "plannedNonOtjHours": 0.0,
        "monthHint": "Month 30",
        "gatewayType": "internal",
    },
    {
        "blockNumber": 12,
        "title": "End-Point Assessment",
        "itemType": "epa",
        "weekStart": None,
        "weekEnd": None,
        "plannedOtjHours": 0.0,
        "plannedNonOtjHours": 0.0,
        "monthHint": "Month 30",
    },
]

PRACTICALS = {
    1: [
        ("Vehicle Safety Inspection and Workshop Preparation", "Block_1_Task_3_Vehicle_Safety_Inspection_v1.0.pdf", "Block_1_Task_3_Vehicle_Safety_Inspection"),
        ("Basic Brake and Tyre Condition Check", "Block_1_Task_4_Basic_Braking_and_Tyre_Check_v1.0.pdf", "Block_1_Task_4_Basic_Braking_and_Tyre_Check"),
    ],
    2: [
        ("Battery and Charging System Inspection", "Block_2_Task_3_Battery_and_Charging_Check_v1.0.pdf", "Block_2_Task_3_Battery_and_Charging_Check"),
        ("TPMS, Tyre Pressure and Customer Documentation", "Block_2_Task_4_TPMS_and_Tyre_Service_v1.0.pdf", "Block_2_Task_4_TPMS_and_Tyre_Service"),
    ],
    3: [
        ("Interim Service, Inspection and Documentation", "Block_3_Task_3_Interim_Service_and_Documentation_v1.0.pdf", "Block_3_Task_3_Interim_Service_and_Documentation"),
        ("Environmental Spill Response and Waste Control", "Block_3_Task_4_Environmental_Spill_and_Waste_Control_v1.0.pdf", "Block_3_Task_4_Environmental_Spill_and_Waste_Control"),
    ],
    4: [
        ("Front Wheel Alignment and Steering Geometry Checks", "Block_4_Task_3_Front_Wheel_Alignment_v1.0.pdf", "Block_4_Task_3_Front_Wheel_Alignment"),
        ("EV/Hybrid Component Location and Safety Awareness", "Block_4_Task_4_EV_Hybrid_Component_Location_v1.0.pdf", "Block_4_Task_4_EV_Hybrid_Component_Location"),
    ],
    5: [
        ("Brake Inspection, Measurement and Replacement", "Block_5_Task_3_Brake_Inspection_and_Replacement_v1.0.pdf", "Block_5_Task_3_Brake_Inspection_and_Replacement"),
        ("Suspension Component Replacement and Alignment Preparation", "Block_5_Task_4_Suspension_Component_Replacement_v1.0.pdf", "Block_5_Task_4_Suspension_Component_Replacement"),
    ],
    6: [
        ("Electrical Diagnostic Testing and Evidence Recording", "Block_6_Task_3_Electrical_Diagnostic_Check_v1.0.pdf", "Block_6_Task_3_Electrical_Diagnostic_Check"),
        ("Air Conditioning and Climate-Control Checks", "Block_6_Task_4_Air_Conditioning_Climate_Check_v1.0.pdf", "Block_6_Task_4_Air_Conditioning_Climate_Check"),
    ],
    7: [
        ("Steering Component Replacement and Customer Recommendations", "Block_7_Task_3_Steering_Component_Replacement_v1.0.pdf", "Block_7_Task_3_Steering_Component_Replacement"),
        ("Engine Management Sensor Check and Handover", "Block_7_Task_4_Engine_Management_Sensor_Check_v1.0.pdf", "Block_7_Task_4_Engine_Management_Sensor_Check"),
    ],
    8: [
        ("ABS Wheel Speed Sensor Diagnostic Investigation", "Block_8_Task_3_ABS_Wheel_Speed_Diagnostic_v1.0.pdf", "Block_8_Task_3_ABS_Wheel_Speed_Diagnostic"),
        ("Tyre Wear Root-Cause and Geometry Investigation", "Block_8_Task_4_Tyre_Wear_Root_Cause_v1.0.pdf", "Block_8_Task_4_Tyre_Wear_Root_Cause"),
    ],
    9: [
        ("EV/Hybrid Customer Handover and Charging Awareness", "Block_9_Task_3_EV_Customer_Handover_v1.0.pdf", "Block_9_Task_3_EV_Customer_Handover"),
        ("ADAS Pre-Calibration and Sensor Awareness Check", "Block_9_Task_4_ADAS_Pre_Calibration_Check_v1.0.pdf", "Block_9_Task_4_ADAS_Pre_Calibration_Check"),
    ],
    10: [
        ("EPA Mock Integrated Practical Inspection", "Block_10_Task_3_EPA_Mock_Integrated_Inspection_v1.0.pdf", "Block_10_Task_3_EPA_Mock_Integrated_Inspection"),
        ("Capstone Practical Task, QA and Professional Discussion Evidence", "Block_10_Task_4_Capstone_Practical_Task_v1.0.pdf", "Block_10_Task_4_Capstone_Practical_Task"),
    ],
}

PATTERNS = [
    re.compile(
        r"^Block\s+(\d+)\s*\|\s*Week\s+(\d+)(?:\s*\(Month\s+\d+\))?\s*\|\s*(.+)$"
    ),
    # e.g. Block 8 | Week 76 - Duty 6: ...
    re.compile(r"^Block\s+(\d+)\s*\|\s*Week\s+(\d+)\s*-\s*(.+)$"),
    re.compile(r"^Block\s+(\d+)\s+Week\s+(\d+)\s*-\s*(.+)$"),
    re.compile(
        r"^Block\s+(\d+)\s*/\s*Week\s+(\d+)\s*\(Session\s*([AB])[^)]*\)\s*-\s*(.+)$"
    ),
    re.compile(r"^Block\s+(\d+)\s*/\s*Week\s+(\d+)\s*-\s*(.+)$"),
]


def parse_sessions(text: str) -> list[dict]:
    sessions: list[dict] = []
    flags: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line.startswith("Block "):
            continue
        m = PATTERNS[3].match(line)
        if m:
            block, week, sess, topic = m.groups()
            sessions.append(
                {
                    "blockNumber": int(block),
                    "calendarWeek": int(week),
                    "sessionIndexInWeek": 1 if sess == "A" else 2,
                    "sessionLetter": sess,
                    "title": topic.strip(),
                    "topic": topic.strip(),
                    "sourceLine": line,
                }
            )
            continue
        for pat in (PATTERNS[0], PATTERNS[1], PATTERNS[2], PATTERNS[4]):
            m = pat.match(line)
            if not m:
                continue
            block, week, topic = m.groups()
            # Avoid capturing table-of-contents / summary lines without teaching topic
            if topic.strip().lower().startswith("weeks "):
                continue
            sessions.append(
                {
                    "blockNumber": int(block),
                    "calendarWeek": int(week),
                    "sessionIndexInWeek": 1,
                    "sessionLetter": None,
                    "title": topic.strip(),
                    "topic": topic.strip(),
                    "sourceLine": line,
                }
            )
            break

    # Deduplicate by (block, week, index) keeping first detailed title
    seen = set()
    unique = []
    for s in sessions:
        key = (s["blockNumber"], s["calendarWeek"], s["sessionIndexInWeek"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(s)

    unique.sort(
        key=lambda s: (s["calendarWeek"], s["sessionIndexInWeek"], s["blockNumber"])
    )

    # Expected: calendar weeks 1-112 represented; 113 sessions with W112 A+B
    weeks_covered = {s["calendarWeek"] for s in unique}
    missing_weeks = [w for w in range(1, 113) if w not in weeks_covered]
    if missing_weeks:
        flags.append(f"MISSING_CALENDAR_WEEKS: {missing_weeks}")

    if len(unique) != 113:
        flags.append(f"SESSION_COUNT={len(unique)} expected 113")

    # Enrich FS codes for block 1
    for s in unique:
        if s["blockNumber"] == 1:
            m = re.search(r"FS(\d{2})", s["title"])
            s["foundationSkillCode"] = f"FS{m.group(1)}" if m else None
        else:
            s["foundationSkillCode"] = None
        if s["sessionLetter"]:
            s["sessionKey"] = f"W{s['calendarWeek']:03d}-{s['sessionLetter']}"
        else:
            s["sessionKey"] = f"W{s['calendarWeek']:03d}"

    for i, s in enumerate(unique, start=1):
        s["sequence"] = i

    return unique, flags


def main() -> None:
    text = SOW.read_text(encoding="utf-8", errors="replace")
    sessions, flags = parse_sessions(text)

    otj_sum = sum(b["plannedOtjHours"] for b in BLOCKS)
    if abs(otj_sum - 611.5) > 0.001:
        flags.append(f"BLOCK_OTJ_SUM={otj_sum} expected 611.5")

    tasks = []
    for block_n in range(1, 11):
        p3, p4 = PRACTICALS[block_n]
        tasks.extend(
            [
                {
                    "blockNumber": block_n,
                    "taskNumber": 1,
                    "kind": "knowledge_test",
                    "title": f"Block {block_n} Knowledge Assessment",
                    "sourcePdf": "Knowledge_Test_Result_Record_Simple_v1.0.pdf",
                    "evidenceRef": "Knowledge_Test_Result_Record_Simple",
                    "curriculumPurposes": ["KNOWLEDGE_CHECKS", "ASSESSES"],
                },
                {
                    "blockNumber": block_n,
                    "taskNumber": 2,
                    "kind": "job_card",
                    "title": f"Block {block_n} Employer Job Card",
                    "sourcePdf": "Apprentice_Job_Card_v1.0.pdf",
                    "evidenceRef": "Apprentice_Job_Card",
                    "curriculumPurposes": ["RECORDS_EVIDENCE", "PRACTISES"],
                },
                {
                    "blockNumber": block_n,
                    "taskNumber": 3,
                    "kind": "practical",
                    "title": p3[0],
                    "sourcePdf": p3[1],
                    "evidenceRef": p3[2],
                    "curriculumPurposes": ["PRACTISES", "ASSESSES"],
                },
                {
                    "blockNumber": block_n,
                    "taskNumber": 4,
                    "kind": "practical",
                    "title": p4[0],
                    "sourcePdf": p4[1],
                    "evidenceRef": p4[2],
                    "curriculumPurposes": ["PRACTISES", "ASSESSES"],
                },
                {
                    "blockNumber": block_n,
                    "taskNumber": 5,
                    "kind": "reflection",
                    "title": f"Block {block_n} Reflection and Review",
                    "sourcePdf": "Task_5_Block_Reflection_and_Review_v1.0.pdf",
                    "evidenceRef": "Task_5_Block_Reflection_and_Review",
                    "curriculumPurposes": ["REFLECTION", "RECORDS_EVIDENCE"],
                },
            ]
        )

    fixture = {
        "phase": 1,
        "standardCode": "ST0499",
        "standardVersion": "1.3",
        "programmeTitle": "Autocare Technician Level 2",
        "plannedEligibleOtjHours": 611.5,
        "publishedMinimumOtjHours": 605,
        "calendarWeeks": 112,
        "plannedSessions": 113,
        "source": {
            "sow": "Autocare Technician Level 2 Scheme of Work Clean Master v4.4",
            "decisions": "AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md",
            "sowExtract": str(SOW),
        },
        "deliveryMilestones": [
            {
                "key": "GW1",
                "title": "Delivery milestone: Gateway 1",
                "itemType": "milestone",
                "afterBlock": 5,
                "monthsFromStart": 12,
                "description": "Operational mid-programme gateway. Not a curriculum block. Controlled curriculum gateway remains Block 11.",
            },
            {
                "key": "GW2",
                "title": "Delivery milestone: Gateway 2",
                "itemType": "milestone",
                "afterBlock": 10,
                "monthsFromStart": 24,
                "description": "Operational mid-programme gateway. Not a curriculum block. Controlled curriculum gateway remains Block 11.",
            },
        ],
        "blocks": BLOCKS,
        "sessions": sessions,
        "tasks": tasks,
        "flags": flags,
        "intentionallyNull": [
            "resource→session bindings",
            "KSB Primary mappings",
            "typed KSB relationships TEACHES/PRACTISES/ASSESSES",
            "assurance findings / HOLDs / Golden B",
            "KSB requirement components",
            "learning objectives as separate rows",
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixture, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"sessions={len(sessions)} tasks={len(tasks)} flags={flags}")


if __name__ == "__main__":
    main()
