import fs from "fs";
import { unzipSync, strFromU8 } from "./lib/tiny-inflate-zip.mjs";

function decode(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function docxText(p) {
  const z = unzipSync(fs.readFileSync(p));
  let raw = strFromU8(z["word/document.xml"]);
  raw = raw.replace(/<\/w:p>/g, "\n");
  return decode(raw.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const res = JSON.parse(
  fs.readFileSync(
    "tests/artifacts/autocare-v1/evidence-enriched/staging/catalogue-resources.json",
    "utf8",
  ),
);

const want = [
  /Week_078_Lesson_Plan/,
  /Week_011_Lesson_Plan/,
  /Week_038_Lesson_Plan/,
  /Foundation_Skills_FS01_Week_1/,
  /Foundation_Skills_FS09/,
  /LESSON PLAN\s+29/,
  /LESSON PLAN\s+25/,
  /Group 14 Session 1/,
  /Exhausts and Emissions plan 1/,
  /Exhausts and Emissions plan 3/,
  /LV Suspension Systems Practical/,
  /Introduction to Suspension Systems/,
];

const keys = [
  "FCA",
  "PCI",
  "diversit",
  "inclusiv",
  "equality",
  "EDI",
  "emission",
  "EGR",
  "DPF",
  "SCR",
  "catalytic",
  "manufacturer",
  "schedule",
  "inspection",
  "suspension",
  "state of health",
  "HV battery",
  "payment",
  "fraud",
  "GDPR",
];

for (const re of want) {
  const r = res.find(
    (x) =>
      re.test(x.sourceFilename || "") ||
      re.test(x.relativePath || "") ||
      re.test(x.originalPath || ""),
  );
  console.log("\n====", String(re), "====");
  if (!r) {
    console.log("NOT IN CATALOGUE");
    continue;
  }
  const p = r.originalPath;
  console.log(p);
  if (!fs.existsSync(p)) {
    console.log("PATH MISSING");
    console.log((r.excerpt || "").slice(0, 700));
    continue;
  }
  try {
    const t = docxText(p);
    for (const k of keys) if (new RegExp(k, "i").test(t)) console.log("HIT", k);
    console.log(t.replace(/\s+/g, " ").slice(0, 1100));
  } catch (e) {
    console.log("ERR", e.message);
    console.log((r.excerpt || "").slice(0, 700));
  }
}
