/**
 * AI-1.1 failure analysis — retrieval vs judgement on Portal-AI disagreements.
 * Evaluation labels are used ONLY for scoring; never written into prompts.
 */
import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const r = spawnSync(
  process.execPath,
  [
    "--env-file=.env.local",
    "./node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.ai11.config.ts",
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);

process.exit(r.status ?? 1);
