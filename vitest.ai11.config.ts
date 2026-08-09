import { defineConfig } from "vitest/config";
import path from "node:path";

/** Failure-analysis only — does not overwrite frozen AI-1 eval artifacts. */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/features/programme-definition/domain/curriculum-analysis/ai11-failure-analysis.live.test.ts",
    ],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
