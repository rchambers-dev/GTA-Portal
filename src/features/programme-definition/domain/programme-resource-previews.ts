/**
 * Preview derivatives for programme resources.
 * Separate from original binaries and text extracts.
 */

export type ResourcePreviewType =
  | "slide_images"
  | "slide_html"
  | "pdf"
  | "video";

export type ResourcePreviewStatus =
  | "ready"
  | "stale"
  | "failed"
  | "unavailable";

export type ResourcePreviewSlide = {
  index: number;
  storagePath?: string;
  mimeType?: string;
  text: string[];
};

export type ResourcePreviewManifest = {
  slides: ResourcePreviewSlide[];
  generator?: string;
};

export type ProgrammeResourcePreviewRecord = {
  id: string;
  resourceId: string;
  binaryId: string | null;
  programmeVersionId: string;
  previewType: ResourcePreviewType;
  status: ResourcePreviewStatus;
  generatedFromBinaryHash: string;
  storageBucket: string;
  slideCount: number;
  failureReason: string;
  manifest: ResourcePreviewManifest;
  createdAt: string;
  updatedAt: string;
};

export type ResourceViewerKind = "slides" | "pdf" | "video" | "none";
export type ResourceOpenMode = "preview" | "download" | "extract" | "none";

export function isPresentationFilename(filename: string): boolean {
  return /\.(ppt|pptx|pptm)$/i.test(filename.trim());
}

export function previewIsCurrent(input: {
  preview: ProgrammeResourcePreviewRecord | null | undefined;
  binarySha256?: string | null;
}): boolean {
  const preview = input.preview;
  if (!preview || preview.status !== "ready") return false;
  if (preview.slideCount < 1 && preview.previewType === "slide_images") {
    return false;
  }
  const hash = input.binarySha256?.trim();
  if (hash && preview.generatedFromBinaryHash !== hash) return false;
  return true;
}

export function describeResourceOpen(input: {
  filename: string;
  binaryAvailable: boolean;
  previewAvailable: boolean;
  extractAvailable: boolean;
}): {
  binaryAvailable: boolean;
  previewAvailable: boolean;
  extractAvailable: boolean;
  openMode: ResourceOpenMode;
  openLabel: string;
  downloadLabel: string | null;
  extractLabel: string | null;
  unavailableNote: string | null;
  previewUnavailableNote: string | null;
  viewerKind: ResourceViewerKind;
} {
  const filename = input.filename;
  const isPpt = isPresentationFilename(filename);
  const isPdf = /\.pdf$/i.test(filename);
  const isVideo = /\.mp4$/i.test(filename);
  const downloadLabel = input.binaryAvailable ? "Download original" : null;
  const extractLabel = input.extractAvailable
    ? "View extract"
    : null;

  if (isPpt && input.previewAvailable) {
    return {
      binaryAvailable: input.binaryAvailable,
      previewAvailable: true,
      extractAvailable: input.extractAvailable,
      openMode: "preview",
      openLabel: "Open presentation",
      downloadLabel,
      extractLabel,
      unavailableNote: null,
      previewUnavailableNote: null,
      viewerKind: "slides",
    };
  }
  if (isPdf && input.binaryAvailable) {
    return {
      binaryAvailable: true,
      previewAvailable: true,
      extractAvailable: input.extractAvailable,
      openMode: "preview",
      openLabel: "Open document",
      downloadLabel,
      extractLabel,
      unavailableNote: null,
      previewUnavailableNote: null,
      viewerKind: "pdf",
    };
  }
  if (isVideo && input.binaryAvailable) {
    return {
      binaryAvailable: true,
      previewAvailable: true,
      extractAvailable: input.extractAvailable,
      openMode: "preview",
      openLabel: "Play video",
      downloadLabel,
      extractLabel,
      unavailableNote: null,
      previewUnavailableNote: null,
      viewerKind: "video",
    };
  }
  if (isPpt && input.binaryAvailable && !input.previewAvailable) {
    return {
      binaryAvailable: true,
      previewAvailable: false,
      extractAvailable: input.extractAvailable,
      openMode: "download",
      openLabel: "Download original",
      downloadLabel: null,
      extractLabel: input.extractAvailable ? "View extract" : null,
      unavailableNote: null,
      previewUnavailableNote: "Preview unavailable",
      viewerKind: "none",
    };
  }
  if (input.binaryAvailable) {
    return {
      binaryAvailable: true,
      previewAvailable: false,
      extractAvailable: input.extractAvailable,
      openMode: "download",
      openLabel: "Download original",
      downloadLabel: null,
      extractLabel,
      unavailableNote: null,
      previewUnavailableNote: isPpt ? "Preview unavailable" : null,
      viewerKind: "none",
    };
  }
  if (input.extractAvailable) {
    return {
      binaryAvailable: false,
      previewAvailable: false,
      extractAvailable: true,
      openMode: "extract",
      openLabel: "View learning extract",
      downloadLabel: null,
      extractLabel: null,
      unavailableNote: "Original file not currently available",
      previewUnavailableNote: null,
      viewerKind: "none",
    };
  }
  return {
    binaryAvailable: false,
    previewAvailable: false,
    extractAvailable: false,
    openMode: "none",
    openLabel: "Unavailable",
    downloadLabel: null,
    extractLabel: null,
    unavailableNote: "Original file not currently available",
    previewUnavailableNote: null,
    viewerKind: "none",
  };
}
