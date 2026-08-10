import fs from "fs";
import path from "path";
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

const files = [
  ".tmp-live/lp/02_Specialist_Lesson_Plans__Autocare_L2_Week_011_Lesson_Plan_v4.4.docx",
  ".tmp-live/lp/02_Specialist_Lesson_Plans__Autocare_L2_Week_078_Lesson_Plan_v4.4.docx",
  ".tmp-live/lp/02_Specialist_Lesson_Plans__Autocare_L2_Week_088_Lesson_Plan_v4.4.docx",
  ".tmp-live/lp/01_Shared_Foundation_Skills_FS01-FS10_v1.2__Foundation_Skills_FS01_Week_1_Lesson_Plan_v1.2.docx",
];

for (const f of files) {
  const t = docxText(f);
  console.log("\n##", path.basename(f));
  console.log("FCA", /FCA|Financial Conduct/i.test(t), "PCI", /PCI|payment card industry/i.test(t));
  console.log(
    "inclusiv",
    /inclusiv|diversit|equity|respectful of different/i.test(t),
  );
  console.log("B5 token", /\bB5\b/.test(t));
  for (const re of [
    /FCA[\s\S]{0,120}/i,
    /PCI[\s\S]{0,120}/i,
    /inclusiv[\s\S]{0,140}/i,
    /diversit[\s\S]{0,140}/i,
    /B5[\s\S]{0,80}/,
  ]) {
    const m = t.match(re);
    if (m) console.log(">", m[0].slice(0, 180));
  }
}

const dir = ".tmp-live/lp";
const all = fs.readdirSync(dir).filter((x) => x.endsWith(".docx"));
const fca = [];
const incl = [];
for (const name of all) {
  try {
    const t = docxText(path.join(dir, name));
    if (/FCA|Financial Conduct|\bPCI\b|payment card industry/i.test(t)) fca.push(name);
    if (/inclusiv|diversit|equity, diversity|respectful of different views/i.test(t))
      incl.push(name);
  } catch {
    /* skip */
  }
}
console.log("\nFCA/PCI LP hits", fca);
console.log("inclusiv LP hits count", incl.length, incl.slice(0, 40));
