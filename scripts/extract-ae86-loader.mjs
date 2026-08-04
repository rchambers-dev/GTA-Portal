import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(
  "D:/GTA Website/src/components/loaders/ae86-loader.html",
  "utf8",
);
const match = html.match(/image\.src='data:image\/png;base64,([^']+)'/);
if (!match) {
  console.error("No base64 image found");
  process.exit(1);
}

const buf = Buffer.from(match[1], "base64");
const targets = [
  "D:/GTA Portal/public/loaders",
  "D:/GTA Website/public/loaders",
];
for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ae86.png"), buf);
  console.log("wrote", path.join(dir, "ae86.png"), buf.length);
}

const script = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || "";
const animStart = script.indexOf("function smoke");
console.log("---ANIM---");
console.log(script.slice(animStart, animStart + 1400));
