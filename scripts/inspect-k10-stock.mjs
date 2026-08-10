import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { unzipSync, strFromU8 } from "./lib/tiny-inflate-zip.mjs";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

function docx(p) {
  const z = unzipSync(fs.readFileSync(p));
  let r = strFromU8(z["word/document.xml"]);
  r = r.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ");
  return r.replace(/\s+/g, " ").trim();
}

async function pdf(p) {
  const d = new PDFParse({ data: fs.readFileSync(p) });
  const r = await d.getText();
  return (r.pages || []).map((x) => x.text || "").join("\n");
}

const base =
  "C:/Users/ReissChambers/OneDrive - Doncaster GTA/Desktop/Autocare Learning Materials/ACS L2 Lesson plans and resources";
const files = [
  "G05 Basic Steering and Suspension/Lesson Plan 9 - Introduction to Steering Systems.docx",
  "G05 Basic Steering and Suspension/Lesson Plan 10 - Introduction to power Steering.docx",
  "G05 Basic Steering and Suspension/Resources/ACS Steering & suspension Assignment.docx",
  "G11 Advance Steering and Suspension/Group 11 session 1 electronic steering.docx",
  "G03 Wheels and Tyres/Resources/Wheels_and_Tyres_Initial_Assessment_Level2.docx",
];

for (const rel of files) {
  const f = path.join(base, rel);
  console.log("\n====", path.basename(f));
  try {
    console.log(docx(f).slice(0, 1400));
  } catch (e) {
    console.log("ERR", e.message);
  }
}

for (const f of [
  ".tmp-live/prac/Block_7_Task_3_Steering_Component_Replacement_v2.0.pdf",
  ".tmp-live/prac/Block_4_Task_3_Front_Wheel_Alignment_v2.0.pdf",
]) {
  console.log("\n====", f);
  console.log((await pdf(f)).slice(0, 1000));
}

const idx = fs.readFileSync(
  ".tmp-corpus-inventory/Autocare_L2_Lesson_Plan_Index_v4.4.csv",
  "utf8",
);
console.log("\nSTOCK-RELATED LESSON INDEX ROWS");
for (const line of idx.split(/\r?\n/)) {
  if (/stock|parts|goods|inventory|warranty|sourc/i.test(line)) {
    console.log(line.slice(0, 240));
  }
}
