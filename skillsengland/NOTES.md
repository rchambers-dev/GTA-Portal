# Probe findings (live API — Aug 2026)

Temporary notes from `npm run probe:skills-england`. Raw JSON is under `out/` (gitignored).

## Auth

- Header: `X-API-KEY`
- Env: `SKILLS_ENGLAND_API_KEY` in `.env.local`

## OCC0499 — Autocare technician (v1.3)

Successful call:

`GET /api/v1/Occupations/OCC0499?expand=...`

| Field | Value |
| --- | --- |
| `stdCode` | `OCC0499` |
| `name` | Autocare technician |
| `level` | 2 |
| `versionNo` | `1.3` |
| `statusName` | Approved occupation |
| Duties | 10 |
| Knowledges | 34 |
| Skills | 25 |
| Behaviours | 5 |
| Involved employers | 121 |
| Green | Mid Green |

Also returns:

- Overview (one-liner) + HTML summary
- Typical job titles + keywords
- Map hierarchy (route / pathway / cluster / technical level)
- SOC 2020 mappings
- Products (apprenticeship + TQs) — apprenticeship product code **`ST0499`**
- Links (website / related API urls)
- Duty ↔ K/S/B mappings on each duty

`--full` expands duties/KSBs as top-level arrays: `duties`, `knowledges`, `skills`, `behaviours` (not nested under a `dutiesKSB` object).

## Progression

`GET /api/v1/OccupationalProgression/OCC0499` → 200 with `keyStdCode`, `occupations`, `progressions`.

## Routes

`GET /api/v1/Routes` → 200, **15** routes.

## Portal relevance

Useful immediately for catalogue sync:

1. Resolve `OCC*` / `ST*` → title, level, version, status
2. Pull live KSBs + duty mappings instead of scraping HTML
3. Link apprenticeship product (`ST0499`) to occupation (`OCC0499`)
4. Show Skills England attribution/logo wherever this data is public-facing

This folder stays throwaway until we decide on a real server adapter.
