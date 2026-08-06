# Skills England API — temporary probe

Scratch pad to explore the [Occupational Maps Public API](https://occupational-maps.skillsengland.education.gov.uk/public-api/) before wiring it into the portal.

**Do not treat this folder as production code.** Responses land in `out/` (gitignored).

## Autocare dump

Readable export of everything pulled for Autocare:

- [`AUTOCARE_TECHNICIAN_OCC0499.md`](./AUTOCARE_TECHNICIAN_OCC0499.md)
- [`DATA_COLLATION_FOR_REVIEW.md`](./DATA_COLLATION_FOR_REVIEW.md) — dual-source collation (Maps + ST JSON) for external review

Regenerate after a fresh probe:

```bash
npm run probe:skills-england -- OCC0499 --full
node skillsengland/generate-autocare-doc.mjs
```

## Setup

1. API key in `.env.local` (repo root):

```env
SKILLS_ENGLAND_API_KEY=your-key-here
```

2. Also add the same var in Vercel for deployed environments later.

Header name for all calls: `X-API-KEY`  
Base URL: `https://occupational-maps-api.skillsengland.education.gov.uk/api/v1`

## Run

From repo root:

```bash
npm run probe:skills-england
npm run probe:skills-england -- OCC0499
npm run probe:skills-england -- OCC0499 --full
npm run probe:skills-england -- --routes
npm run probe:skills-england -- --lookups
npm run probe:skills-england -- --search "autocare"
```

`-full` expands `occupation.dutiesKSB` (duties + KSBs) — larger files.

## What you can pull

| Endpoint idea | Flag / path |
| --- | --- |
| One occupation | default `OCC0499` |
| Overview, summary, SOC, map hierarchy, job titles, products, keywords, employers, green, links | default expands |
| Duties + KSBs | `--full` |
| Occupational progression | auto after a successful occupation fetch |
| All routes | `--routes` |
| Lookup lists | `--lookups` |
| Search occupations | `--search "..."` |

Swagger UI: https://occupational-maps-api.skillsengland.education.gov.uk/swagger/index.html

## Licence (public-facing)

If Skills England data is shown in a public product, use their logo + attribution (OGL). See their public API page.

## Next (portal)

This folder is only for discovery. A proper Next.js server adapter can reuse the same endpoints later; keep the key server-side and never `NEXT_PUBLIC_*`.
