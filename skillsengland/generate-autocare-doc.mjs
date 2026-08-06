/**
 * One-off: turn OCC0499 full probe JSON into a readable markdown doc.
 * Usage: node skillsengland/generate-autocare-doc.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "out");

function latest(prefix) {
  const files = readdirSync(outDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort();
  if (!files.length) throw new Error(`No files matching ${prefix}* in out/`);
  return path.join(outDir, files.at(-1));
}

function cell(s) {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/** Turn API HTML summary into plain paragraphs for markdown. */
function htmlToMarkdown(html) {
  if (!html) return "_None_";
  return String(html)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function labelOf(item, ...keys) {
  if (typeof item === "string") return item;
  for (const k of keys) {
    if (item?.[k] != null && item[k] !== "") return String(item[k]);
  }
  return JSON.stringify(item);
}

const fullPath = latest("occupation-OCC0499-full-");
const progPath = latest("progression-OCC0499-");
const occ = JSON.parse(readFileSync(fullPath, "utf8")).body;
const prog = JSON.parse(readFileSync(progPath, "utf8")).body;

const L = [];
const p = (...xs) => L.push(...xs);

p("# Autocare technician (OCC0499) — Skills England dump");
p("");
p("_Temporary export from the Occupational Maps Public API for local review._");
p("");
p(
  "**Source:** `GET /api/v1/Occupations/OCC0499` (full expands) + `OccupationalProgression/OCC0499`",
);
p("");
p(`**Fetched from:** \`${path.basename(fullPath)}\``);
p("");
p("---");
p("");
p("## Overview");
p("");
p("| Field | Value |");
p("| --- | --- |");
p(`| Name | ${cell(occ.name)} |`);
p(`| Occupation code (\`stdCode\`) | ${cell(occ.stdCode)} |`);
p(`| Level | ${cell(occ.level)} |`);
p(`| Version | ${cell(occ.versionNo)} |`);
p(
  `| Status | ${cell(occ.statusName)} (code ${cell(occ.status)}) |`,
);
p(`| Status last updated | ${cell(occ.statusLastUpdated)} |`);
p(`| Overview | ${cell(occ.overview)} |`);
p(
  `| Green | ${
    occ.greenOccupation?.isGreen
      ? `Yes — ${cell(occ.greenOccupation.classification)}`
      : "No"
  } |`,
);
p("");
p("### Summary");
p("");
p(htmlToMarkdown(occ.summary));
p("");

const mh = occ.mapHierarchy || {};
p("## Map hierarchy");
p("");
p("| Level | Value |");
p("| --- | --- |");
p(`| Route | ${cell(mh.routeName)} (id ${cell(mh.routeId)}) |`);
p(`| Pathway | ${cell(mh.pathwayName)} (id ${cell(mh.pathwayId)}) |`);
p(`| Cluster | ${cell(mh.clusterName)} (id ${cell(mh.clusterId)}) |`);
p(`| Cluster group id | ${cell(mh.clusterGroupId)} |`);
p(
  `| Technical level | ${cell(mh.technicalLevelName)} (code ${cell(mh.technicalLevel)}) |`,
);
p("");

const soc = occ.soc || {};
p("## SOC mapping");
p("");
p("| Field | Value |");
p("| --- | --- |");
p(
  `| SOC 2020 | ${cell(soc.soc2020Code)} — ${cell(soc.soc2020Description)} |`,
);
p(
  `| SOC 2010 | ${
    soc.soc2010Code
      ? `${cell(soc.soc2010Code)} — ${cell(soc.soc2010Description)}`
      : "_Not set_"
  } |`,
);
p("");
if (soc.soc2020SubUnitGroups?.length) {
  p("### SOC 2020 sub-unit groups");
  p("");
  p("| Code | Description | Primary |");
  p("| --- | --- | --- |");
  for (const g of soc.soc2020SubUnitGroups) {
    p(
      `| ${cell(g.code)} | ${cell(g.description)} | ${g.isPrimary ? "Yes" : "No"} |`,
    );
  }
  p("");
}

p("## Typical job titles");
p("");
for (const t of occ.typicalJobTitles || []) {
  const name = labelOf(t, "name", "title");
  const green =
    typeof t === "object" && (t?.isGreen || t?.isGreenJobTitle)
      ? " _(green job title)_"
      : "";
  p(`- ${name}${green}`);
}
p("");

p("## Keywords");
p("");
p(
  (occ.keywords || [])
    .map((k) => labelOf(k, "name", "keyword"))
    .join(", ") || "_None_",
);
p("");

p("## Products (technical education)");
p("");
p("| Product code | Name | Type | Level | Status |");
p("| --- | --- | --- | --- | --- |");
for (const prod of occ.products || []) {
  p(
    `| ${cell(prod.productCode)} | ${cell(prod.name)} | ${cell(prod.typeName)} | ${cell(prod.level)} | ${cell(prod.statusName)} |`,
  );
}
p("");

p(`## Duties (${occ.duties?.length ?? 0})`);
p("");
for (const d of occ.duties || []) {
  p(`### ${cell(d.dutyId)}${d.isThisACoreDuty ? " — core" : ""}`);
  p("");
  p(cell(d.dutyDetail));
  p("");
  if (d.criteriaForMeasuringPerformance) {
    p(`**Performance criteria:** ${cell(d.criteriaForMeasuringPerformance)}`);
    p("");
  }
  p(
    `- Mapped knowledge: ${(d.mappedKnowledge || []).join(", ") || "_none_"}`,
  );
  p(`- Mapped skills: ${(d.mappedSkills || []).join(", ") || "_none_"}`);
  p(
    `- Mapped behaviours: ${(d.mappedBehaviour || []).join(", ") || "_none_"}`,
  );
  p("");
}

p(`## Knowledge (${occ.knowledges?.length ?? 0})`);
p("");
p("| ID | Detail |");
p("| --- | --- |");
for (const k of occ.knowledges || []) {
  p(`| ${cell(k.knowledgeId)} | ${cell(k.detail)} |`);
}
p("");

p(`## Skills (${occ.skills?.length ?? 0})`);
p("");
p("| ID | Detail |");
p("| --- | --- |");
for (const s of occ.skills || []) {
  p(`| ${cell(s.skillId)} | ${cell(s.detail)} |`);
}
p("");

p(`## Behaviours (${occ.behaviours?.length ?? 0})`);
p("");
p("| ID | Detail |");
p("| --- | --- |");
for (const b of occ.behaviours || []) {
  p(`| ${cell(b.behaviourId)} | ${cell(b.detail)} |`);
}
p("");

/** API returns a comma-separated string, or occasionally an array. */
function employerList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((e) => labelOf(e, "name", "employerName"));
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const employers = employerList(occ.involvedEmployers).sort((a, b) =>
  a.localeCompare(b),
);
p(`## Involved employers (${employers.length})`);
p("");
for (const e of employers) p(`- ${e}`);
p("");

p("## Links");
p("");
if (occ.links?.length) {
  for (const link of occ.links) {
    const rel = link.rel ?? link.relationship ?? link.type ?? "link";
    const href = link.href ?? link.url ?? link.uri ?? JSON.stringify(link);
    const title = link.title ? ` — ${link.title}` : "";
    p(`- **${cell(rel)}**: ${href}${title}`);
  }
} else {
  p("_None_");
}
p("");

p("## Occupational progression");
p("");
p(`Key standard: **${cell(prog.keyStdCode)}**`);
p("");

if (prog.occupations?.length) {
  p("### Related occupations in progression map");
  p("");
  p("| Code | Name | Level | Version | Status |");
  p("| --- | --- | --- | --- | --- |");
  for (const o of prog.occupations) {
    p(
      `| ${cell(o.stdCode ?? o.code)} | ${cell(o.name ?? o.title)} | ${cell(o.level)} | ${cell(o.versionNo)} | ${cell(o.statusName)} |`,
    );
  }
  p("");
}

if (prog.progressions?.length) {
  p("### Progression links");
  p("");
  p("| From | To |");
  p("| --- | --- |");
  for (const row of prog.progressions) {
    p(
      `| ${cell(row.stdCodeFrom ?? row.fromStdCode)} | ${cell(row.stdCodeTo ?? row.toStdCode)} |`,
    );
  }
  p("");
} else {
  p("_No `progressions` array rows._");
  p("");
  p("```json");
  p(JSON.stringify(prog, null, 2));
  p("```");
  p("");
}

p("---");
p("");
p("## Attribution");
p("");
p("© Skills England");
p("");
p(
  "This information is licensed under the [Open Government Licence](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3).",
);
p("");
p(
  "Raw API payloads (gitignored): `skillsengland/out/occupation-OCC0499-full-*.json`, `skillsengland/out/progression-OCC0499-*.json`.",
);
p("");

const outFile = path.join(__dirname, "AUTOCARE_TECHNICIAN_OCC0499.md");
writeFileSync(outFile, L.join("\n"), "utf8");
console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${L.length} lines)`);
