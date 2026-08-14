import { describe, expect, it } from "vitest";
import {
  catalogueFileOpenCapabilities,
  classifyLearnerMaterialKind,
  suggestedAudienceForRole,
} from "./programme-resources";

describe("resource audience and kind", () => {
  it("suggests Learner visible for learner roles, including PowerPoints", () => {
    expect(suggestedAudienceForRole("LEARNER_LEARNING")).toBe("LEARNER_VISIBLE");
    expect(suggestedAudienceForRole("PRACTICE")).toBe("LEARNER_VISIBLE");
    expect(suggestedAudienceForRole("LEARNER_REVISION")).toBe("LEARNER_VISIBLE");
    expect(suggestedAudienceForRole("TUTOR_DELIVERY")).toBe("TUTOR_ONLY");
  });

  it("labels PowerPoint by extension, not by tutor-only assumption", () => {
    expect(
      classifyLearnerMaterialKind({
        filename: "hybrid-awareness.pptx",
        title: "Hybrid awareness",
        role: "LEARNER_LEARNING",
      }),
    ).toEqual({
      kind: "powerpoint",
      kindLabel: "PowerPoint",
      openLabel: "Open presentation",
    });
    expect(
      classifyLearnerMaterialKind({
        filename: "Features of Hybrid Vehicles.ppt",
        title: "Features of Hybrid Vehicles",
        role: "TUTOR_DELIVERY",
      }).kindLabel,
    ).toBe("PowerPoint");
  });

  it("does not claim original binaries can be opened in the portal", () => {
    for (const filename of [
      "notes.pdf",
      "deck.ppt",
      "deck.pptx",
      "deck.pptm",
      "plan.docx",
      "notes.txt",
    ]) {
      const caps = catalogueFileOpenCapabilities(filename);
      expect(caps.originalBinaryHostedInPortal).toBe(false);
      expect(caps.previewInBrowser).toBe(false);
      expect(caps.downloadOriginal).toBe(false);
      expect(caps.canShowExtractIfPresent).toBe(true);
    }
  });
});
