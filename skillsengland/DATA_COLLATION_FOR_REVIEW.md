# Skills England data collation — Autocare (OCC0499 / ST0499)

**Purpose:** Single scan document of everything confirmed for importing apprenticeship standards into GTA Portal (programme spine builder).  
**Audience:** Internal review + external AI review (e.g. ChatGPT).  
**Fetched:** 2026-08-05 (live probes).  
**Status:** Research / pre-build — not production code.

---

## 1. Bottom line

| Question | Answer |
| --- | --- |
| Can we get official duties + KSBs + duty↔KSB mappings? | **Yes** (both sources) |
| Can we get funding, duration, compliance hours, LARS, EPA period? | **Yes** (apprenticeshipstandards endpoint) |
| Is there one documented API for everything? | **No** — use two sources |
| Enough for immutable standard-version snapshot + spine builder validation? | **Yes**, for ST0499 phase 1 |

**Recommended import rule:**

1. **Occupational Maps API** = documented occupational curriculum source (OCC).  
2. **Apprenticeship standards JSON** = product / funding / hours / EPA metadata (ST). Soft-depend; validate; keep raw payload; fail soft.  
3. Store both raw payloads; never let staff edit official wording.

---

## 2. Source A — Occupational Maps API (documented)

| Item | Detail |
| --- | --- |
| Status | Public beta, documented, API key issued |
| Base URL | `https://occupational-maps-api.skillsengland.education.gov.uk/api/v1` |
| Auth | Header `X-API-KEY` |
| Docs | https://occupational-maps.skillsengland.education.gov.uk/public-api/ |
| Example | `GET /Occupations/OCC0499?expand=...` |
| Also used | `GET /OccupationalProgression/OCC0499`, `GET /Routes` |

### What “request more data” means here

Docs section **“Requesting expanded information”** = `expand=` query params only.  
**Not** “email us for funding fields.”  
Contact email exists for rate limits / publication enquiries: `occupationalmaps.skillsengland@DWP.GOV.UK`.

### Confirmed expands used

`occupation.overview`, `summary`, `soc`, `maphierarchy`, `typicaljobtitles`, `products`, `keywords`, `involvedemployers`, `links`, `green`, `dutiesKSB`

### OCC0499 confirmed values

| Field | Value |
| --- | --- |
| Occupation code (`stdCode`) | OCC0499 |
| Title | Autocare technician |
| Version | 1.3 |
| Level | 2 |
| Status | Approved occupation |
| Overview | Carrying out a range of services and repairs to cars, car derived vans and light goods vehicles. |
| Route | Engineering and manufacturing |
| Pathway | Maintenance, installation and repair |
| Cluster | Service, repair and/or overhaul operative or technician |
| Green | Mid Green |
| SOC 2020 | 5231 — Vehicle technicians, mechanics and electricians |
| Duties | **10** |
| Knowledge | **34** |
| Skills | **25** |
| Behaviours | **5** |

### Linked products (from Maps)

Includes apprenticeship **ST0499** plus several TQ product codes (IMI / City & Guilds).

### Duty↔KSB mapping shape (Maps)

Duties expose **human codes** and UUIDs:

- `dutyId`: `D1`…  
- `mappedKnowledge`: `K1`, `K2`, …  
- `mappedSkills`: `S1`, …  
- `mappedBehaviour`: `B1`, …  
- Plus parallel `*Ids` UUID arrays  

**Useful for GTA:** human codes (`K1`/`S1`/`B1`/`D1`) are builder-friendly.

### Progression (Maps)

`OccupationalProgression/OCC0499` returns related occupations and from→to links, e.g.:

- OCC0499 → OCC0031 (Automotive glazing)  
- OCC0499 → OCC0033 (Light vehicle)  
- (+ others in payload)

### What Maps does **not** return (confirmed)

| Field | In Maps? |
| --- | --- |
| Maximum funding £13,000 | No |
| Typical duration 30 months | No |
| Assessment period 3 months | No |
| Minimum compliance hours 605 | No |
| LARS code 283 | No |
| Full EPA plan body | No (links only) |
| Historical versions 1.1 / 1.2 | Not via a versions endpoint we found |

Product object for ST0499 from Maps is thin:

```json
{
  "productCode": "ST0499",
  "name": "Autocare technician",
  "level": 2,
  "statusName": "Approved for delivery",
  "typeName": "Apprenticeship"
}
```

---

## 3. Source B — Apprenticeship standards JSON (undocumented / website-backed)

| Item | Detail |
| --- | --- |
| Status | Publicly reachable JSON; **no formal Swagger / contract found** |
| URL pattern | `https://skillsengland.education.gov.uk/api/apprenticeshipstandards/{ST_CODE}` |
| Example | https://skillsengland.education.gov.uk/api/apprenticeshipstandards/ST0499 |
| Auth | None observed (open GET) |
| Content-Type | `application/json` |
| HTTP | **200** confirmed for ST0499 |

### ST0499 Key information (matches Skills England webpage)

| Field (API) | Value |
| --- | --- |
| `referenceNumber` | ST0499 |
| `occupationCode` | OCC0499 |
| `title` | Autocare technician |
| `version` / `versionNumber` | 1.3 |
| `level` | 2 |
| `status` | Approved for delivery |
| `typicalDuration` | **30** (months) |
| `ePALength` | **3** (months) |
| `minimumHoursForCompliance` | **"605"** (string in JSON) |
| `maxFunding` | **13000** |
| `larsCode` | **283** |
| `route` | Engineering and manufacturing |
| `pathway` | Maintenance, installation and repair |
| `cluster` | Service, repair and/or overhaul operative or technician |
| `assessmentPlanUrl` | `…/st0499-v1-3?view=epa` |
| `standardPageUrl` | `…/st0499-v1-3` |
| `approvedForDelivery` | 2018-05-24 |
| `lastUpdated` / `changedDate` | 2025-09-19 |
| `earliestStartDate` (this version) | 2025-09-19 |
| EQA | Ofqual (`eQAProvider.providerName`) |

### Curriculum also present on ST endpoint

| Collection | Count |
| --- | --- |
| Duties | 10 |
| Knowledges | 34 |
| Skills | 25 |
| Behaviours | 5 |
| Qualifications (gateway quals listed) | 2 |

Sample duty mapping style differs from Maps: ST duties use UUID arrays in `mappedKnowledge` / `mappedSkills` / `mappedBehaviour` (not always `K1`/`S1` human codes on the duty object). KSBs themselves carry `knowledgeId` / `skillId` / `behaviourId` style human ids on the KSB records.

### Full top-level key list (ST endpoint, 79 keys)

`templateType`, `shortAssessment`, `larsCode`, `referenceNumber`, `learningAimClassCode`, `title`, `status`, `approvedForDeliveryPausedStarts`, `url`, `qualificationStandardUrl`, `versionNumber`, `change`, `changedDate`, `earliestStartDate`, `latestStartDate`, `latestEndDate`, `overviewOfRole`, `level`, `ePALength`, `typicalDuration`, `minimumHoursForCompliance`, `maxFunding`, `maxFundingAdditionalInformation`, `route`, `keywords`, `jobRoles`, `entryRequirements`, `assessmentPlanUrl`, `ssa1`, `ssa2`, `version`, `standardInformation`, `occupationalSummary`, `knowledges`, `behaviours`, `skills`, `optionsUnstructuredTemplate`, `proposalApproved`, `standardApproved`, `standardPublished`, `epaApprovalDate`, `epaPublished`, `fundingApprovalDate`, `eQAProvider`, `approvedForDelivery`, `integratedApprenticeship`, `integration`, `integratedDegree`, `tbReference`, `tbMainContact`, `involvedEmployers`, `otherInvolvedStakeholders`, `regulated`, `regulatedBody`, `coreAndOptions`, `typicalJobTitles`, `greenJobTitles`, `englishAndMathsQualifications`, `reviewDetails`, `pathway`, `cluster`, `clusterId`, `clusterDescription`, `createdDate`, `lastUpdated`, `occupationalStandardApprovalDate`, `banners`, `occupationCode`, `occupationalStandardUrl`, `standardPageUrl`, `qualifications`, `professionalRecognition`, `duties`, `options`, `regulationDetail`, `optionsUnstructuredKsbMapping`, `careerStarter`, `coronationEmblem`, `publishDate`

### Caveats for Source B

- Undocumented; shape may change without notice.  
- Prefer Zod validation + raw payload storage + graceful degrade.  
- Do **not** treat as more “official” than Maps for occupation identity; treat as complementary product metadata (+ optional cross-check of KSBs).  
- Full EPA assessment plan **content** is a URL/page, not a structured methods payload.

---

## 4. LARS / DfE side-note (not used as primary API)

| Item | Detail |
| --- | --- |
| Find a learning aim | Confirms Autocare Technician — **Code 283 / ST0499** |
| What we saw on LARS detail | Identity / dates / sector / SSA — **not** the full Key information funding row in that panel |
| Automation path | LARS **dataset downloads** (not a simple “get Key info” live API) |
| DfE Find and Use an API | Separate portal (client ID/secret/subscription); vacancy/recruitment style APIs; **not required** now that ST JSON returns funding/hours |

---

## 5. Field coverage matrix (import + spine builder)

| Need | Maps API | ST JSON | Notes |
| --- | --- | --- | --- |
| OCC code | Yes | Yes (`occupationCode`) | Cross-check both |
| ST code | Via products | Yes (`referenceNumber`) | |
| Title | Yes | Yes | |
| Version | Yes (`versionNo`) | Yes | Prefer match before save |
| Level / status | Yes | Yes | |
| Duties | Yes | Yes | Prefer Maps for human `D*` codes |
| Knowledge / Skills / Behaviours | Yes | Yes | Prefer Maps human codes |
| Duty↔KSB mappings | Yes (codes + UUIDs) | Yes (UUID-heavy on duties) | Normalise carefully |
| Linked TQs / products | Yes | Partial (`qualifications`) | Different shapes |
| Progression map | Yes | Example routes on page / ST fields limited | Use Maps progression |
| Route / pathway / cluster | Yes | Yes | |
| Typical duration months | No | Yes (`typicalDuration`) | |
| Assessment / EPA period months | No | Yes (`ePALength`) | |
| Min compliance hours | No | Yes (`minimumHoursForCompliance`) | Cast string→number |
| Max funding £ | No | Yes (`maxFunding`) | |
| LARS code | No | Yes (`larsCode`) | Matches Find a learning aim 283 |
| Assessment plan URL | Links only | Yes | |
| Full EPA method detail | No | No | Page scrape / later |
| Historical retired versions | Not found | Unknown pattern | Keep local catalog if needed |
| SOC / green | Yes | Limited | Maps stronger |

---

## 6. Suggested source-of-truth split (for the product idea)

| Data class | Authoritative import source | Staff editable? |
| --- | --- | --- |
| Official duties / KSB wording / codes / official mappings | Maps (documented), ST as cross-check | **No** — immutable snapshot |
| Funding, duration, compliance hours, LARS, EPA length | ST JSON | No if imported; manual entry only if ST fetch fails (audit who/when) |
| GTA spine (blocks, internal gateways, EPA stage, tasks) | GTA authored | Yes |
| Task↔KSB coverage mappings | GTA authored on top of imported KSBs | Yes (with validation) |
| Planned learning hours roll-up | Calculated from tasks | Derived |

**Hierarchy (product intent):**

```
Standard (ST0499)
  └─ Standard version (1.3) [immutable import]
       └─ GTA programme version [draft → published]
            └─ Spine
                 └─ Spine items (blocks | gateways | epa | …)
                      └─ Tasks (+ parts, KSB maps, durations)
```

---

## 7. GTA Portal current-state (repo, pre-build)

Already exists conceptually, mostly **not** as immutable DB import:

- Hard-coded Autocare packs / `AUTOCARE_STANDARD` (incl. 605 hours, £13k) in TypeScript  
- ST0499 KSB catalog JSON (versioned 1.1 / 1.2 / 1.3) under docs + domain  
- Dual delivery spines: **groups** (CEA) vs **blocks**  
- Course Builder largely localStorage + some form tables  
- Cohorts store `standard_code`, `standard_version`, `delivery_spine`  
- **No** `standard_versions` / duties / ksbs / spine_items tables yet  

So the proposed model is **additive**, not a rewrite of live apprentice delivery.

---

## 8. Mechanical standards named for later import

Stable external codes (DB PK should be UUID):

| ST | Title (working) | Level |
| --- | --- | --- |
| ST0499 | Autocare Technician | 2 |
| ST0033 | Vehicle Maintenance and Repair Technician (light vehicle) | 3 |
| ST0068 | Heavy Vehicle Technician | 3 |
| ST0403 | Vehicle Damage Panel Technician | 3 |
| ST0448 | Vehicle Damage Paint Technician | 3 |

First build target: **ST0499 only**.

---

## 9. Attribution / licence

Public use of Skills England data needs **Skills England logo + OGL attribution**.  
Maps API: documented requirement.  
ST JSON: still Skills England content — treat attribution the same for public UI.

---

## 10. Evidence files in this folder

| File | What |
| --- | --- |
| `AUTOCARE_TECHNICIAN_OCC0499.md` | Readable Maps dump (duties/KSBs/etc.) |
| `NOTES.md` | Early probe notes |
| `README.md` | How to run probe |
| `client.mjs` / `probe.mjs` | Maps API temp client |
| `out/` | Raw JSON probes (gitignored) |
| `out/_collation-raw.json` | Raw dual-source snapshot used to write this doc |

Regenerate Maps dump:

```bash
npm run probe:skills-england -- OCC0499 --full
node skillsengland/generate-autocare-doc.mjs
```

---

## 11. Open risks / questions for design review

1. Prefer Maps vs ST when duty/KSB wording differs slightly?  
2. How to map ST UUID duty mappings → human `K*`/`S*`/`B*` codes reliably?  
3. Undocumented ST endpoint SLA — fallback to manual verified fields?  
4. Do we need historical OCC/ST versions via API, or keep GTA’s local catalog for retired versions?  
5. EPA plan: store URL only in v1, or later ingest structured assessment outcomes?  
6. How programme spine (blocks/gateways) relates to existing Autocare TS packs / CEA groups without breaking live delivery?

---

## 12. Plain-English summary for external review

We can import Autocare as an official standard snapshot using two HTTP sources.

**Source 1 (documented):** Skills England Occupational Maps API → the job’s duties and KSBs, how they map, linked quals, progression, and map placement. Needs an API key.

**Source 2 (live but undocumented):** Skills England website JSON at `/api/apprenticeshipstandards/ST0499` → funding £13k, 30 months duration, 3 month assessment period, 605 minimum hours, LARS 283, assessment plan link, dates. Also repeats duties/KSBs.

Together that is enough to build an immutable imported standard version and validate a GTA-designed programme spine (blocks, gateways, EPA, tasks, hours coverage) against official KSBs and minimum compliance hours — provided we treat Source 2 carefully and do not let staff edit official wording.

---

*End of collation. Safe to share with ChatGPT for architecture critique; strip API keys if any are pasted elsewhere (this doc contains no secrets).*
