import { describe, expect, it } from "vitest";
import {
  describeResourceOpen,
  previewIsCurrent,
} from "./programme-resource-previews";
import type { ProgrammeResourcePreviewRecord } from "./programme-resource-previews";

function preview(
  input: Partial<ProgrammeResourcePreviewRecord>,
): ProgrammeResourcePreviewRecord {
  return {
    id: "p1",
    resourceId: "r1",
    binaryId: "b1",
    programmeVersionId: "pv",
    previewType: "slide_images",
    status: "ready",
    generatedFromBinaryHash: "abc",
    storageBucket: "gta-programme-resource-binaries",
    slideCount: 3,
    failureReason: "",
    manifest: { slides: [{ index: 1, storagePath: "x", text: [] }] },
    createdAt: "",
    updatedAt: "",
    ...input,
  };
}

describe("describeResourceOpen", () => {
  it("uses Open presentation only when a portal preview exists", () => {
    const withPreview = describeResourceOpen({
      filename: "TEST_W003_learner_presentation_SAFE_DEMO.pptx",
      binaryAvailable: true,
      previewAvailable: true,
      extractAvailable: true,
    });
    expect(withPreview.openMode).toBe("preview");
    expect(withPreview.openLabel).toBe("Open presentation");
    expect(withPreview.downloadLabel).toBe("Download original");
    expect(withPreview.extractLabel).toBe("View extract");
    expect(withPreview.viewerKind).toBe("slides");
  });

  it("does not call download Open presentation when preview is missing", () => {
    const noPreview = describeResourceOpen({
      filename: "Features of Hybrid Vehicles.ppt",
      binaryAvailable: true,
      previewAvailable: false,
      extractAvailable: true,
    });
    expect(noPreview.openLabel).not.toBe("Open presentation");
    expect(noPreview.previewUnavailableNote).toBe("Preview unavailable");
    expect(noPreview.downloadLabel).toBeNull();
    expect(noPreview.openLabel).toBe("Download original");
  });

  it("keeps extract-only honest", () => {
    const extractOnly = describeResourceOpen({
      filename: "deck.pptx",
      binaryAvailable: false,
      previewAvailable: false,
      extractAvailable: true,
    });
    expect(extractOnly.openMode).toBe("extract");
    expect(extractOnly.openLabel).toBe("View learning extract");
    expect(extractOnly.unavailableNote).toBe(
      "Original file not currently available",
    );
  });

  it("opens PDFs and MP4s in portal without a separate derivative", () => {
    const pdf = describeResourceOpen({
      filename: "notes.pdf",
      binaryAvailable: true,
      previewAvailable: false,
      extractAvailable: false,
    });
    expect(pdf.openMode).toBe("preview");
    expect(pdf.viewerKind).toBe("pdf");
    expect(pdf.openLabel).toBe("Open document");
    const video = describeResourceOpen({
      filename: "clip.mp4",
      binaryAvailable: true,
      previewAvailable: false,
      extractAvailable: false,
    });
    expect(video.openMode).toBe("preview");
    expect(video.viewerKind).toBe("video");
    expect(video.openLabel).toBe("Play video");
  });

  it("treats Word files as download plus extract unless a preview exists", () => {
    const doc = describeResourceOpen({
      filename: "plan.docx",
      binaryAvailable: true,
      previewAvailable: false,
      extractAvailable: true,
    });
    expect(doc.openMode).toBe("download");
    expect(doc.openLabel).toBe("Download original");
    expect(doc.viewerKind).toBe("none");
  });
});

describe("previewIsCurrent", () => {
  it("rejects a preview generated from a different original hash", () => {
    expect(
      previewIsCurrent({
        preview: preview({ generatedFromBinaryHash: "old" }),
        binarySha256: "new",
      }),
    ).toBe(false);
  });

  it("accepts a ready slide preview matching the original hash", () => {
    expect(
      previewIsCurrent({
        preview: preview({ generatedFromBinaryHash: "abc" }),
        binarySha256: "abc",
      }),
    ).toBe(true);
  });

  it("rejects stale or empty slide previews", () => {
    expect(
      previewIsCurrent({
        preview: preview({ status: "stale" }),
        binarySha256: "abc",
      }),
    ).toBe(false);
    expect(
      previewIsCurrent({
        preview: preview({ slideCount: 0 }),
        binarySha256: "abc",
      }),
    ).toBe(false);
  });
});
