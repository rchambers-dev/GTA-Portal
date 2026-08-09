import { spawnSync } from "child_process";

const mode = process.argv.includes("--portal_ai") ? "portal_ai" : "heuristic";
process.env.GOLDEN_EVAL_MODE = mode;
if (mode === "portal_ai") {
  // Manual golden eval is an explicit integration command — allow full 64-KSB pass.
  process.env.AI_DAILY_REQUEST_CAP = "0";
}

const result = spawnSync(
  process.execPath,
  [
    "--env-file=.env.local",
    "./node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.live.config.ts",
  ],
  { stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
