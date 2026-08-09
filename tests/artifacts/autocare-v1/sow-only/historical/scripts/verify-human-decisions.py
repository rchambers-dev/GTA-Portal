#!/usr/bin/env python3
"""Verify human-review conditionals against original curriculum corpus. REVIEW ONLY."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"D:\GTA Portal")
c = json.loads((ROOT / ".tmp-original-curriculum-corpus.json").read_text(encoding="utf-8"))


def flatten(v) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return " ".join(flatten(x) for x in v)
    if isinstance(v, dict):
        return " ".join(flatten(x) for x in v.values())
    return str(v)


def session(week: int) -> dict:
    return next(x for x in c["sessions"] if x["week"] == week)


def act(s: dict, key: str) -> str:
    acts = s.get("activities") or {}
    if isinstance(acts, dict):
        return flatten(acts.get(key))
    return ""


print("=== K6 TOOL MAINT/CALIBRATION ===")
for s in c["sessions"]:
    body = flatten(s).lower()
    if any(
        p in body
        for p in [
            "calibration",
            "tool control",
            "tool storage",
            "store tools",
            "maintain tools",
            "maintenance of tools",
            "tool care",
            "equipment care",
            "return tools",
        ]
    ):
        print("W", s["week"], "B", s["block"], s.get("topic"))
        for part in ["theory", "practical", "application"]:
            t = act(s, part).lower()
            for p in [
                "calibration",
                "tool control",
                "tool storage",
                "equipment care",
                "tool care",
                "store",
                "maintain",
            ]:
                i = t.find(p)
                if i >= 0:
                    print(" ", part, ":", t[max(0, i - 80) : i + 160])
                    break

print("\n=== K10 STEERING SYSTEMS ===")
for s in c["sessions"]:
    body = flatten(s).lower()
    if "steering" in body and any(
        p in body
        for p in [
            "power assisted",
            "hydraulic",
            "epas",
            "rack",
            "steering system",
            "steering component",
        ]
    ):
        print("W", s["week"], "B", s["block"], s.get("topic"))
        print("  theory:", act(s, "theory")[:350])

print("\n=== K8 MANUALS/WARRANTY/SERVICE RECORDS ===")
for s in c["sessions"]:
    body = flatten(
        {k: s.get(k) for k in ["topic", "aims", "learningObjectives", "activities"]}
    ).lower()
    if any(
        p in body
        for p in [
            "warranty",
            "owner's manual",
            "owners manual",
            "service record",
            "service history",
            "workshop manual",
            "technical manual",
            "manufacturer manual",
        ]
    ):
        print("W", s["week"], "B", s["block"], s.get("topic"))
        print(" ", act(s, "theory")[:400])

print("\n=== W53 theory/practical ===")
s = session(53)
print("THEORY:", act(s, "theory")[:900])
print("PRACTICAL:", act(s, "practical")[:900])
print("APPLICATION:", act(s, "application")[:900])

print("\n=== W106 practical/application ===")
s = session(106)
print("PRACTICAL:", act(s, "practical")[:900])
print("APPLICATION:", act(s, "application")[:900])

print("\n=== W35 warranty ===")
s = session(35)
print("TOPIC", s.get("topic"))
print("THEORY:", act(s, "theory")[:900])
print("PRACTICAL:", act(s, "practical")[:900])

print("\n=== W77 equipment care ===")
try:
    s = session(77)
    print("TOPIC", s.get("topic"))
    print("THEORY:", act(s, "theory")[:900])
    print("PRACTICAL:", act(s, "practical")[:900])
except StopIteration:
    print("missing")

# steering week search by topic
print("\n=== topics containing steering ===")
for s in c["sessions"]:
    t = (s.get("topic") or "").lower()
    if "steering" in t:
        print("W", s["week"], "B", s["block"], s.get("topic"))
        print(" ", act(s, "theory")[:400])
