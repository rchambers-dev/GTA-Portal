import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("apprentices preview still replaces the intake screen", () => {
  it("renders the preview and keeps the previous intake implementation", () => {
    const intake = readFileSync(
      path.join(process.cwd(), "src/features/administration/screens/AdminApprenticeIntakeScreen.tsx"),
      "utf8",
    );
    expect(intake).toContain("export function AdminApprenticeIntakeScreenLive");
    expect(intake).toContain("return <ApprenticesVisualPreview />");
  });
});
