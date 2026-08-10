# R51-4 Traceability chains (organic only)

Notation: `source → relationship → claim` · weeks only where EXPLICIT · no mass-map.

## K9 Tyres knowledge

```
G3 LP2 Wheels & Tyres (res_lm_8b1b94878563_7)
  → TEACHES [EXPLICIT] construction/inspection/R&R/puncture
  → provenance GROUP_G3 · week null

W14 TPMS LP (res_lp_5ad392e7e654)
  → TEACHES [EXPLICIT] TPMS
  → Block 2 · Week 14 EXPLICIT

B2 Task 4 TPMS (res_prac_b58e0adc803a)
  → PRACTISES [EXPLICIT] tyre/TPMS service

CEA 3.1–3.5
  → ASSESSES [EXPLICIT] R&R / puncture / TPMS / balance / runflat

W64 TPMS integration (res_lp_ca80733bd5d0)
  → REINFORCES [EXPLICIT] · Block 7 · Week 64 — NOT Primary

Tyres.ppt (res_lm_9f5cb6fbb8f3_11)
  → SUPPORTS? [INFERRED_LOW / UNEXTRACTED] legislation/sidewall candidate
```

**Confidence:** HIGH operational · MEDIUM legislation/labelling (absence/visibility)

## K14 HVAC

```
G6 Heating & ventilation PPT (res_lm_da4a93c2da80_51)
  → TEACHES [EXPLICIT] cabin heating

G13 AC Lessons 1–2 (+3–5)
  → TEACHES [EXPLICIT] AC components/layout/function; refrigerants R134a/R1234YF

CEA 13.1–13.3
  → PRACTISES/ASSESSES [EXPLICIT] condenser / expansion valve / compressor

B6 Task 4 climate check (res_prac_a9fd893baee0)
  → PRACTISES/ASSESSES [EXPLICIT] · Block 6
```

**Confidence:** HIGH · depth note on full component-set naming

## K15 LV batteries / starting / charging (knowledge)

```
FS04 (res_lp_4e5d5534a1f4)
  → SUPPORTS [EXPLICIT] AWARENESS only · Week 4 · MUST NOT OWN

G7 LP23 Batteries (res_lm_466bab823d76_55)
  → TEACHES [EXPLICIT] battery purpose/function

G7 LP24 Starting & Charging (res_lm_2ca8ded587ac_56)
  → TEACHES [EXPLICIT] starting/charging principles

Batteries.pptx (res_lm_277e84194c5f_58)
  → TEACHES [EXPLICIT] battery + starter + alternator roles

Starting/Charging KA (res_lm_cdf93a50039d_65)
  → ASSESSES [EXPLICIT]

B2 Task 3 (res_prac_139a816c6d1e)
  → PRACTISES [EXPLICIT] inspection · Block 2 — not Primary theory

e-machine
  → NOT FOUND in excerpt scan
```

**Confidence:** HIGH core · HIGH absence on e-machine

## K16 Maintain/replace LV batteries / starting / charging

```
CEA 7.1 Starter / 7.2 Alternator / 7.3 Battery
  → PRACTISES + ASSESSES [EXPLICIT] · GROUP_G7

GW1 battery/charging R&R (gw_f0ceef633f24)
  → PREPARES_FOR_GATEWAY [EXPLICIT] — not Primary

B2 Task 3
  → early inspection PRACTISES — do not steal from G7
```

**Confidence:** HIGH

## K17 ADAS awareness / calibration methods

```
G11 ADAS LP + PPT (res_lm_5d8bcd0589f2_87, res_lm_95f371942a77_98)
  → TEACHES [EXPLICIT] ADAS awareness + calibration after repairs

CEA 11.6 ADAS fault
  → PRACTISES/ASSESSES [EXPLICIT]

W89 + B9 Task 4 (res_lp_43f67c596f10, res_prac_126c9fbc1032)
  → REINFORCES / PRACTISES [EXPLICIT] pre-calibration · Block 9

static / dynamic methods (named)
  → NOT FOUND in excerpts
```

**Confidence:** HIGH awareness · MEDIUM methods depth

## K19 Four-wheel geometry principles

```
G3 LP3A (res_lm_801be46beaa3_8)
  → TEACHES [EXPLICIT] geometry terms / alignment / adjustment

G11 geometry decks
  → REINFORCES [EXPLICIT] toe / camber

CEA 5.1 + B4 Task 3
  → PRACTISES/ASSESSES [EXPLICIT]

Ackermann / thrust angle
  → NOT FOUND · Wheel Alignment.ppt UNEXTRACTED (visibility)
```

**Confidence:** HIGH core · MEDIUM named-principle gaps

## S4 Store / maintain / calibration / return tools

```
FS02 (res_lp_a1de2dadb565) Week 2
  → TEACHES/PRACTISES [EXPLICIT] maintain / condition / select

FS05 (res_lp_f311ff09e560) Week 5
  → TEACHES/PRACTISES [EXPLICIT] calibration checks

ADAS B9 pre-cal
  → NOT S4 (different calibration meaning)

Store/return-to-storage
  → thinner / embedded (companion K6 residual)
```

**Confidence:** HIGH ownership to B1 · MEDIUM storage depth

## S8 Select/use tools + measuring + diagnostic

```
FS02 → TEACHES/PRACTISES tools [EXPLICIT] W2
FS05 → TEACHES/PRACTISES mechanical measuring [EXPLICIT] W5
FS04/FS07 → TEACHES/PRACTISES electrical measuring / multimeter [EXPLICIT]
W42+ diagnostic weeks → REINFORCES [INFERRED_MEDIUM] — not Primary steal
```

**Confidence:** HIGH

## S14 Record service / parts / repair

```
FS10 (res_lp_76cd8f807cd7) Week 10
  → TEACHES/PRACTISES [EXPLICIT] job cards / technical documentation

CEA assessment records + later documentation weeks (W58 B6)
  → ASSESSES / REINFORCES — W58 not Primary

Gateway documentation requirements
  → PREPARES_FOR_GATEWAY — not Primary
```

**Confidence:** HIGH
