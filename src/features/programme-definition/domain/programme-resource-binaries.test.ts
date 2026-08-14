import { describe, expect, it } from "vitest";
import {
  binaryOpenLabel,
  browserCanInlineFilename,
  contentDispositionForFilename,
  mimeTypeForFilename,
} from "./programme-resource-binaries";

describe("programme resource binaries", () => {
  it("maps supplied file types to MIME types", () => {
    expect(mimeTypeForFilename("Features of Hybrid Vehicles.ppt")).toBe(
      "application/vnd.ms-powerpoint",
    );
    expect(mimeTypeForFilename("deck.pptx")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(mimeTypeForFilename("macro.pptm")).toBe(
      "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    );
    expect(mimeTypeForFilename("plan.doc")).toBe("application/msword");
    expect(mimeTypeForFilename("plan.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeTypeForFilename("notes.pdf")).toBe("application/pdf");
    expect(mimeTypeForFilename("clip.mp4")).toBe("video/mp4");
  });

  it("does not promise browser preview for Office files", () => {
    expect(browserCanInlineFilename("a.ppt")).toBe(false);
    expect(browserCanInlineFilename("a.pptx")).toBe(false);
    expect(browserCanInlineFilename("a.pptm")).toBe(false);
    expect(browserCanInlineFilename("a.doc")).toBe(false);
    expect(browserCanInlineFilename("a.docx")).toBe(false);
    expect(browserCanInlineFilename("a.pdf")).toBe(true);
    expect(browserCanInlineFilename("a.mp4")).toBe(true);
    expect(contentDispositionForFilename("a.ppt")).toMatch(/^attachment;/);
    expect(contentDispositionForFilename("a.pdf")).toMatch(/^inline;/);
  });

  it("does not call an Office download Open presentation", () => {
    expect(binaryOpenLabel("notes.docx")).toBe("Download original");
    expect(binaryOpenLabel("clip.mp4")).toBe("Play video");
    expect(binaryOpenLabel("deck.pptx")).toBe("Download original");
    expect(contentDispositionForFilename("a.pptx")).toMatch(/^attachment;/);
  });
});
