# ST0499 Autocare Technician — official KSB version comparison

Sources (Skills England / Institute for Apprenticeships, captured Jul 2026):

- [ST0499 v1.3 apprenticeship](https://skillsengland.education.gov.uk/apprenticeships/st0499-v1-3)
- [OCC0499 current (v1.3 KSBs)](https://skillsengland.education.gov.uk/occupations/OCC0499)
- [OCC0499 v1.2 KSBs](https://www.instituteforapprenticeships.org/qualifications/finder/OCC0499-v1-2)
- [OCC0499 v1.1 legacy KSBs](https://skillsengland.education.gov.uk/occupations/OCC0499-v1-1)

Machine-readable catalogue: `st0499-ksb-catalog.json` (also imported by the portal at `src/features/programme-delivery/domain/st0499-ksb-catalog.ts`).

## How this relates to the portal

| Layer | What it is | Where |
|--------|------------|--------|
| **Official KSBs** (this doc) | K1/S1/B1… statements on the occupational standard | Programme / standard version |
| **Learner RPL K/S/B %** | How much of a *block* the learner already holds for funding | Management → Learner funding |

If Skills England changes KSBs, ship a **new standard version** — do not “fix” it by turning learner RPL steppers up.

## Apprenticeship version log (ST0499)

| Version | Starts | Funding | What changed |
|---------|--------|---------|--------------|
| **1.0** | May 2018 – Oct 2022 | £12,000 | Approved for delivery |
| **1.1** | Oct 2022 – Jan 2025 | £12,000 | EPA plan revised (KSB list still legacy short form) |
| **1.2** | Jan 2025 – Sep 2025 | £13,000 | Standard + EPA + funding band; **expanded KSB catalogue** |
| **1.3** | Sep 2025 – current | £13,000 | Removed duplicate **S9**; EPA Practical Activity 1 → vehicle health check; clearer re-sits |

## Occupation KSB pack shapes

| Occupation pack | Aligned ST0499 | Knowledge | Skills | Behaviours |
|-----------------|----------------|-----------|--------|------------|
| **1.1** (legacy) | 1.0 / 1.1 | 11 | 13 | 5 |
| **1.2** | 1.2 | 34 | **26** | 5 |
| **1.3** (current) | 1.3 | 34 | **25** | 5 |

## Headline diffs

### Legacy (1.1) → expanded (1.2)
Complete rewrite of the KSB catalogue (not a small renumber):

- Knowledge grows **11 → 34** (EV/hydrogen awareness, ADAS, HVAC detail, sales/compliance, digital, EDI, etc.)
- Skills grow **13 → 26** (structured inspection / isolation / stock / sales process skills)
- Behaviours stay at **5**, but wording changes to the modern short form (health & safety first, environment, adaptability, CPD, inclusion)

Portal impact: learners still on **v1.0/v1.1** must keep the **legacy** KSB list; new starts use **v1.3**.

### v1.2 → v1.3 (Skills England published change)
Official note: *“Removed S9 from the KSBs due to duplication with S10.”*

| v1.2 | Statement (summary) | v1.3 |
|------|---------------------|------|
| **S9** | Remove **and replace** vehicle tyre / balance wheels | **Removed** (duplicate) |
| **S10** | Remove, **repair and replace** vehicle tyre / balance wheels | Becomes **S9** |
| **S11** | Inspect/remove/replace steering, brakes, emissions, A/C, battery… | Becomes **S10** |
| **S12…S26** | (same statements) | Renumber **S11…S25** |

Knowledge (K1–K34) and Behaviours (B1–B5) are unchanged between v1.2 and v1.3 in the published occupation pages.

EPA (separate from KSB list): Practical Activity 1 revised to a **vehicle health check and report**; re-sit rules clarified.

## Gaps vs what GTA Portal stores today

| Need | Status |
|------|--------|
| Lock new starts to **v1.3** + £13k + 605 OTJ min | Present on `AUTOCARE_STANDARD` |
| Keep older enrolments on their start version | Partially (cohort notes) — needs hard `standardVersion` on enrolment |
| Versioned official KSB catalogue | **Added** (this pack) |
| Map college tasks / CEA items to KSB codes **per version** | Still thin (some `ST0499:K9` refs; not version-aware) |
| Programme Records UI to browse KSB diffs | Not built yet — data is ready |
| EPA plan differences by version (health check) | Not version-aware in Block 10/12 yet |

## Suggested next build steps

1. Add `standardVersion` on Autocare enrolments (`1.1` \| `1.2` \| `1.3`).
2. Programme Records → open Autocare → show KSB catalogue for that version + “diff to latest”.
3. When mapping tasks to KSBs, resolve codes through `st0499KsbForApprenticeshipVersion`.
4. Align Block 10 EPA mock wording with v1.3 **vehicle health check** for new starts.
