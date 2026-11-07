import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyPageAccessConfig, type PageAccessConfig } from "./model";

export class PageAccessConfigUnavailable extends Error {
  status = 503;
  constructor() {
    super("Page access config is unreadable. Access is closed until it can be read.");
  }
}

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
  const target = pageAccessFilePath();
  let raw: string;
  try {
    raw = readFileSync(/*turbopackIgnore: true*/ target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyPageAccessConfig();
    throw new PageAccessConfigUnavailable();
  }
  try {
    const parsed = JSON.parse(raw) as PageAccessConfig;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !Array.isArray(parsed.workspaceDefaults) ||
      !Array.isArray(parsed.bundles) ||
      !Array.isArray(parsed.direct)
    ) {
      throw new Error("shape");
    }
    return {
      workspaceDefaults: parsed.workspaceDefaults,
      bundles: parsed.bundles,
      direct: parsed.direct,
    };
  } catch (error) {
    if (error instanceof PageAccessConfigUnavailable) throw error;
    throw new PageAccessConfigUnavailable();
  }
}

export function writePageAccessConfig(config: PageAccessConfig) {
  const target = pageAccessFilePath();
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(/*turbopackIgnore: true*/ temporary, JSON.stringify(config));
  renameSync(temporary, target);
}
