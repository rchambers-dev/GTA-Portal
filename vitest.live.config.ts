import { defineConfig } from "vitest/config";
import path from "node:path";

/** Explicit live/eval config — not used by default `npm test`. */
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/features/programme-definition/domain/curriculum-analysis/golden-eval.live.test.ts",
    ],
    testTimeout: 900_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
