import { readFileSync } from "node:fs";

const registry = JSON.parse(
  readFileSync(new URL("../supabase/migration-registry.json", import.meta.url), "utf8"),
);

/**
 * Decides whether scripts/run-migration.mjs may send a file to the target.
 * Applied identities are skipped only when the bytes still match.
 * A different file that reuses an owned number is refused.
 * Held files and rollbacks are never sent.
 *
 * This file is not consulted by the Supabase dashboard, the hosted SQL editor,
 * or the Supabase MCP apply_migration tool. Those paths can still apply a
 * different file numbered 035, including the held PR #1 migration.
 */
export function migrationDecision(filename, sha256) {
  if (registry.neverAutoApply.includes(filename) || filename.includes("rollback")) {
    return { action: "skip", reason: `${filename} is manual only and is not applied automatically.` };
  }
  const applied = registry.applied.find((item) => item.repositoryFile === filename);
  if (applied) {
    if (applied.sha256 !== sha256) {
      return {
        action: "refuse",
        reason: `${filename} no longer matches the applied identity ${applied.hostedVersion} (${applied.sha256}).`,
      };
    }
    return {
      action: "skip",
      reason: `${filename} is already applied as ${applied.hostedVersion}_${applied.hostedName} at ${applied.appliedAt}.`,
    };
  }
  const number = filename.match(/^(\d+)_/)?.[1];
  const owner = number ? registry.ownedNumbers[number] : undefined;
  if (owner && owner !== filename) {
    return {
      action: "refuse",
      reason: `Migration number ${number} belongs to ${owner}. ${filename} must not auto-apply.`,
    };
  }
  if (registry.held.includes(filename)) {
    return { action: "skip", reason: `${filename} is held and must not auto-apply.` };
  }
  return { action: "apply", reason: `${filename} is a pending migration.` };
}
