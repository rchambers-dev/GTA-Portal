import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyPageAccessConfig, type PageAccessConfig } from "./model";

/**
 * Disposable server file for page-access configuration.
 * It is not applied to production. An unconfigured file leaves current
 * capability checks unchanged. STAFF_PAGE_ACCESS_FILE is for tests.
 */
export function pageAccessFilePath() {
  const override = process.env.STAFF_PAGE_ACCESS_FILE;
  if (override) return override;
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ".staff-page-access",
    "config.json",
  );
}

export function readPageAccessConfig(): PageAccessConfig {
  try {
    const parsed = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ pageAccessFilePath(), "utf8"),
    ) as PageAccessConfig;
    if (!parsed || typeof parsed !== "object") return emptyPageAccessConfig();
    return {
      workspaceDefaults: Array.isArray(parsed.workspaceDefaults) ? parsed.workspaceDefaults : [],
      bundles: Array.isArray(parsed.bundles) ? parsed.bundles : [],
      direct: Array.isArray(parsed.direct) ? parsed.direct : [],
    };
  } catch {
    return emptyPageAccessConfig();
  }
}

export function writePageAccessConfig(config: PageAccessConfig) {
  const target = pageAccessFilePath();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ target, JSON.stringify(config));
}
