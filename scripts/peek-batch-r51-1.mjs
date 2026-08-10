import fs from "fs";
import { unzipSync, strFromU8 } from "./lib/tiny-inflate-zip.mjs";

function decode(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function docxText(p) {
  const z = unzipSync(fs.readFileSync(p));
  let raw = strFromU8(z["word/document.xml"]);
  raw = raw.replace(/<\/w:p>/g, "\n");
  return decode(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function pptxText(p) {
  const z = unzipSync(fs.readFileSync(p));
  const slides = Object.keys(z)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort(
      (a, b) =>
        Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]),
    );
  return slides
    .map((s) =>
      decode(
        strFromU8(z[s])
          .replace(/<\/a:p>/g, "\n")
          .replace(/<[^>]+>/g, " "),
      ),
    )
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

const res = JSON.parse(
  fs.readFileSync(
    "tests/artifacts/autocare-v1/evidence-enriched/staging/catalogue-resources.json",
    "utf8",
  ),
);

function pathFor(re) {
  return res.find(
    (x) => re.test(x.sourceFilename || "") || re.test(x.relativePath || ""),
  );
}

const targets = [
  [/Session 2 ADAS Systems\.pptx/i, "pptx"],
  [/Group 11 session 2 ADAS\.docx/i, "docx"],
  [/Lesson Plan 20 - Introduction to Engines - Lubrication/i, "docx"],
  [/Lesson Plan 21 - Introduction to Engines - Lubrication/i, "docx"],
  [/Foundation_Skills_FS02/i, "docx"],
  [/Foundation_Skills_FS03/i, "docx"],
  [/Group 14 Session 1/i, "docx"],
  [/Week_022_Lesson_Plan/i, "docx"],
  [/Sessions 4-5 Geometry/i, "pptx"],
  [/Wheel Alignment\.ppt/i, "ppt"],
];

const keys = [
  "passive",
  "active",
  "autonomy",
  "level",
  "ADAS",
  "oil filter",
  "air filter",
  "brake fluid",
  "schedule",
  "manufacturer",
  "calibrat",
  "storage",
  "tool",
  "industry",
  "role",
  "diversity",
  "equity",
  "inclusion",
  "geometry",
  "Ackermann",
  "camber",
  "toe",
];

for (const [re, kind] of targets) {
  const r = pathFor(re);
  console.log("\n====", String(re), "====");
  if (!r) {
    console.log("missing");
    continue;
  }
  console.log(r.originalPath || r.relativePath);
  console.log("excerpt:", (r.excerpt || "").slice(0, 450).replace(/\s+/g, " "));
  const p = r.originalPath;
  if (!p || !fs.existsSync(p)) {
    console.log("PATH_MISSING");
    continue;
  }
  try {
    let t = "";
    if (p.endsWith(".docx")) t = docxText(p);
    else if (p.endsWith(".pptx")) t = pptxText(p);
    else {
      console.log("skip legacy", kind);
      continue;
    }
    for (const k of keys) if (new RegExp(k, "i").test(t)) console.log("HIT", k);
    console.log(t.slice(0, 1000));
  } catch (e) {
    console.log("ERR", e.message);
  }
}
