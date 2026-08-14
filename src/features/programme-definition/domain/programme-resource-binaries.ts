/**
 * Original programme-resource binaries. Separate from extracts, attachments,
 * role, audience, and Session release.
 */

export const RESOURCE_BINARY_BUCKET = "gta-programme-resource-binaries";

export type ResourceVersionReview =
  | "SAME"
  | "MINOR_REVISION"
  | "MATERIAL_REVISION"
  | "UNRESOLVED_VERSION";

export type ProgrammeResourceBinaryRecord = {
  id: string;
  resourceId: string;
  programmeVersionId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageBucket: string;
  storagePath: string;
  sourceArchive: string;
  sourcePath: string;
  sourceGroupCode: string;
  sourceGroupFolder: string;
  versionReview: ResourceVersionReview;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function mimeTypeForFilename(filename: string): string {
  const ext = filename.trim().match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
  switch (ext) {
    case ".ppt":
      return "application/vnd.ms-powerpoint";
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".pptm":
      return "application/vnd.ms-powerpoint.presentation.macroEnabled.12";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".pdf":
      return "application/pdf";
    case ".mp4":
      return "video/mp4";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function browserCanInlineFilename(filename: string): boolean {
  return /\.(pdf|mp4|txt)$/i.test(filename.trim());
}

export function binaryOpenLabel(filename: string): string {
  if (/\.(pdf)$/i.test(filename)) return "Open document";
  if (/\.(mp4)$/i.test(filename)) return "Play video";
  if (/\.(doc|docx)$/i.test(filename)) return "Download original";
  if (/\.(ppt|pptx|pptm)$/i.test(filename)) return "Download original";
  return "Download original";
}

export function contentDispositionForFilename(filename: string): string {
  const safe = filename.replace(/[\r\n"]/g, "_");
  const mode = browserCanInlineFilename(filename) ? "inline" : "attachment";
  return `${mode}; filename="${safe}"`;
}

export { describeResourceOpen } from "./programme-resource-previews";
export type { ResourceOpenMode } from "./programme-resource-previews";

export function resourceExtractAvailable(resource: {
  extractPath?: string | null;
  evidenceResourceId?: string | null;
}): boolean {
  return Boolean(
    resource.extractPath?.trim() || resource.evidenceResourceId?.trim(),
  );
}
