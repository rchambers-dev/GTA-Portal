import { NextResponse } from "next/server";
import { contentDispositionForFilename } from "./programme-resource-binaries";

export function resourceBinaryHttpResponse(input: {
  bytes: Buffer;
  filename: string;
  mimeType: string;
  forceDownload?: boolean;
}): NextResponse {
  const disposition = input.forceDownload
    ? `attachment; filename="${input.filename.replace(/[\r\n"]/g, "_")}"`
    : contentDispositionForFilename(input.filename);
  return new NextResponse(new Uint8Array(input.bytes), {
    status: 200,
    headers: {
      "Content-Type": input.mimeType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(input.bytes.length),
    },
  });
}
