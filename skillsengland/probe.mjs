/**
 * Temporary CLI probe for the Skills England Occupational Maps API.
 *
 * Usage (from repo root):
 *   npm run probe:skills-england
 *   npm run probe:skills-england -- OCC0499
 *   npm run probe:skills-england -- OCC0499 --full
 *   npm run probe:skills-england -- --routes
 *   npm run probe:skills-england -- --search "motor vehicle"
 *
 * Writes JSON under skillsengland/out/ (gitignored).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seFetch } from "./client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "out");

const DEFAULT_EXPAND = [
  "occupation.overview",
  "occupation.summary",
  "occupation.soc",
  "occupation.maphierarchy",
  "occupation.typicaljobtitles",
  "occupation.products",
  "occupation.keywords",
  "occupation.involvedemployers",
  "occupation.links",
  "occupation.green",
].join(",");

const FULL_EXPAND = `${DEFAULT_EXPAND},occupation.dutiesKSB`;

function parseArgs(argv) {
  const flags = new Set();
  const positionals = [];
  let search = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--full") flags.add("full");
    else if (a === "--routes") flags.add("routes");
    else if (a === "--lookups") flags.add("lookups");
    else if (a === "--search") {
      search = argv[++i] ?? "";
      flags.add("search");
    } else if (a.startsWith("-")) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else {
      positionals.push(a);
    }
  }

  return {
    code: (positionals[0] || "OCC0499").toUpperCase(),
    flags,
    search,
  };
}

async function save(name, payload) {
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
  return file;
}

function summariseOccupation(body) {
  if (!body || typeof body !== "object") return body;
  const o = body;
  return {
    stdCode: o.stdCode ?? o.StdCode,
    title: o.name ?? o.Name ?? o.title ?? o.Title,
    statusName: o.statusName ?? o.StatusName,
    level: o.level ?? o.Level,
    versionNo: o.versionNo ?? o.VersionNo,
    status: o.status ?? o.Status,
    topLevelKeys: Object.keys(o),
  };
}

async function main() {
  const { code, flags, search } = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  console.log("Skills England Occupational Maps API — temp probe");
  console.log("---");

  if (flags.has("routes")) {
    const routes = await seFetch("Routes", { expand: "route.links" });
    console.log(`Routes → HTTP ${routes.status}`);
    await save(`routes-${stamp}.json`, routes);
    if (!routes.ok) process.exit(1);
    return;
  }

  if (flags.has("lookups")) {
    const lookups = await seFetch("Lookups");
    console.log(`Lookups → HTTP ${lookups.status}`);
    await save(`lookups-${stamp}.json`, lookups);
    if (!lookups.ok) {
      // Some deployments use segmented lookup routes — try a few.
      for (const p of [
        "Lookups/OccupationStatuses",
        "Lookups/TechnicalLevels",
        "Lookups/ProductTypes",
      ]) {
        const r = await seFetch(p);
        console.log(`${p} → HTTP ${r.status}`);
        await save(
          `${p.replaceAll("/", "-").toLowerCase()}-${stamp}.json`,
          r,
        );
      }
    }
    return;
  }

  if (flags.has("search")) {
    const q = search || "motor";
    const result = await seFetch("Occupations", { searchTerm: q });
    console.log(`Search "${q}" → HTTP ${result.status}`);
    await save(`search-${q.replace(/\s+/g, "-")}-${stamp}.json`, result);
    if (!result.ok) {
      // Alternate query param names used in similar APIs
      const alt = await seFetch("Occupations/Search", { searchTerm: q });
      console.log(`Occupations/Search → HTTP ${alt.status}`);
      await save(`search-alt-${stamp}.json`, alt);
    }
    return;
  }

  const expand = flags.has("full") ? FULL_EXPAND : DEFAULT_EXPAND;
  const occ = await seFetch(`Occupations/${code}`, { expand });
  console.log(`Occupations/${code} → HTTP ${occ.status}`);
  console.log("Summary:", summariseOccupation(occ.body));
  await save(
    `occupation-${code}${flags.has("full") ? "-full" : ""}-${stamp}.json`,
    occ,
  );

  if (occ.ok) {
    const progression = await seFetch(`OccupationalProgression/${code}`);
    console.log(`OccupationalProgression/${code} → HTTP ${progression.status}`);
    await save(`progression-${code}-${stamp}.json`, progression);
  }

  if (!occ.ok) {
    console.error("Occupation request failed. Check key / code / expand params.");
    process.exit(1);
  }

  console.log("---");
  console.log("Done. Inspect JSON under skillsengland/out/");
  console.log("Tip: add --full to include duties / KSBs (larger payload).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
