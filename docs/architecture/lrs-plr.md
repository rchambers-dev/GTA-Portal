# Learning Records Service (LRS) — Personal Learning Record

## Purpose

ADM14 **1.6 Initial Assessment – PLR Report** imports verified historical achievements from the DfE **Learning Records Service**, separate from PICS.

Workflow:

1. Learner identity captured on AF1.1 (given name, family name, DOB, gender, ULN)
2. Portal finds ULN if missing (LRS Find ULN)
3. Portal requests **Get Learner Learning Events** for that learner
4. Qualifications and participation records are stored on the Documents PLR page
5. Staff mark which achievements are **relevant to RPL** (assessor still maps to KSBs on AF1.5 RPLE)

## Integration constraints (production)

- Access is via LRS **LRB web services** (SOAP / XML / HTTPS), not a public REST API
- GTA must be registered as a Learner Registration Body and approved for Get Learner Learning Events
- Requires LRS compatibility testing, **client certificate**, organisation credentials and **vendor ID**
- Each request needs ULN + given name + family name (DOB / gender improve verification)
- Learner must verify and PLR-sharing / privacy status must allow access
- Sensitive qualifications may remain hidden
- One learner per request — use auto-fetch on enrolment save and **Refresh PLR** in the UI

## Code map

| Piece | Path |
|-------|------|
| Port | `src/features/learner-portal/ports/lrs-plr.ts` |
| Mock + SOAP stub | `src/adapters/lrs/lrs-plr-adapter.ts` |
| Store / auto-fetch | `src/features/learner-portal/domain/plr-store.ts` |
| Documents UI | `src/features/learner-portal/components/PlrReportPanel.tsx` |

`getLrsPlrPort()` currently returns the **mock** adapter (demo learner Alex Morgan, ULN `1234567890`). Switch to a real SOAP implementation after LRB onboarding — keep PICS as the main learner-information source; LRS only supplies verified historical achievement data.
