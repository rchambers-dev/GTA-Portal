/**
 * Private original-binary storage. Never public URLs.
 * Preferred: Supabase Storage bucket (service-role only).
 * Fallback: local gitignored uploads/programme-resources/.
 */

import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RESOURCE_BINARY_BUCKET } from "./programme-resource-binaries";

const LOCAL_ROOT = path.resolve("uploads/programme-resources");

export async function ensureResourceBinaryBucket(
  supabase: SupabaseClient,
): Promise<{ bucket: string; backend: "supabase" | "local" }> {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const exists = (data || []).some((b) => b.name === RESOURCE_BINARY_BUCKET);
    if (!exists) {
      const created = await supabase.storage.createBucket(RESOURCE_BINARY_BUCKET, {
        public: false,
      });
      if (created.error) throw created.error;
    }
    return { bucket: RESOURCE_BINARY_BUCKET, backend: "supabase" };
  } catch {
    fs.mkdirSync(LOCAL_ROOT, { recursive: true });
    return { bucket: "local-uploads", backend: "local" };
  }
}

export async function storeResourceBinaryBytes(input: {
  supabase: SupabaseClient;
  backend: "supabase" | "local";
  bucket: string;
  storagePath: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<void> {
  if (input.backend === "local") {
    const abs = path.join(LOCAL_ROOT, input.storagePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, input.bytes);
    return;
  }
  const { error } = await input.supabase.storage
    .from(input.bucket)
    .upload(input.storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export async function readResourceBinaryBytes(input: {
  supabase: SupabaseClient;
  bucket: string;
  storagePath: string;
}): Promise<Buffer> {
  if (input.bucket === "local-uploads") {
    const abs = path.join(LOCAL_ROOT, input.storagePath);
    if (!fs.existsSync(abs)) throw new Error("Binary was not found.");
    return fs.readFileSync(abs);
  }
  const { data, error } = await input.supabase.storage
    .from(input.bucket)
    .download(input.storagePath);
  if (error || !data) throw new Error(error?.message || "Binary was not found.");
  return Buffer.from(await data.arrayBuffer());
}
