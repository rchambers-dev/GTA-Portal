import { readFileSync } from "node:fs";
import path from "node:path";

/** The original Review Assistant document, without its standalone login or asset tags. */
export function reviewAssistantFragment() {
  const html = readFileSync(
    path.join(process.cwd(), "public/review-assistant/index.html"),
    "utf8",
  );
  const start = html.indexOf('<div class="app-shell">');
  const end = html.indexOf('<link rel="stylesheet" href="/app.css');
  if (start < 0 || end < 0) throw new Error("Review Assistant document markers were not found.");
  return html.slice(start, end);
}
