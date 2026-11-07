import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const previewPath = path.join(
  process.cwd(),
  "src/features/administration/screens/apprentices-visual-preview.tsx",
);
const intakePath = path.join(
  process.cwd(),
  "src/features/administration/screens/AdminApprenticeIntakeScreen.tsx",
);

describe("apprentices visual preview", () => {
  const preview = readFileSync(previewPath, "utf8");
  const intake = readFileSync(intakePath, "utf8");

  it("labels example data and keeps every save control disabled", () => {
    expect(preview).toContain("EXAMPLE DATA");
    expect(preview).toContain("Saving is disabled");
    expect(preview).toContain("Alex Example");
    expect(preview).toContain("Example Motors");
    expect(preview).not.toMatch(/fetch\(|createApprentice|useAdminStore|supabase/);
    expect(preview.match(/disabled/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps the existing intake implementation and only renders the preview", () => {
    expect(intake).toContain("export function AdminApprenticeIntakeScreenLive");
    expect(intake).toContain("return <ApprenticesVisualPreview />");
  });
});
