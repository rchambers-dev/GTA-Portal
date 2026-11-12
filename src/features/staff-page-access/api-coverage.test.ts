import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PORTAL_PAGES } from "./registry";

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry === "route.ts") found.push(full);
  }
  return found;
}

function apiPath(file: string) {
  const relative = path.relative(path.join(process.cwd(), "src/app/api"), path.dirname(file));
  const url = relative
    .split(path.sep)
    .map((part) => (part.startsWith("[") ? "[^/]+" : part))
    .join("/");
  return `/api/${url}`;
}

describe("page registry covers API routes", () => {
  it("matches every API route file with an explicit pattern or the editor exemption", () => {
    const files = routeFiles(path.join(process.cwd(), "src/app/api"));
    const missing: string[] = [];
    for (const file of files) {
      const sample = apiPath(file).replaceAll("[^/]+", "example");
      if (sample === "/api/staff-page-access") continue;
      const source = readFileSync(file, "utf8");
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((method) =>
        source.includes(`export async function ${method}`),
      );
      const matched = PORTAL_PAGES.some((page) => page.pattern.test(sample));
      if (!matched) missing.push(`${sample} (${methods.join(",")})`);
    }
    expect(missing).toEqual([]);
  });
});
