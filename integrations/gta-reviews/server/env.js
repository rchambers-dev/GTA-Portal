import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnv(text) {
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cut = trimmed.indexOf("=");
    if (cut < 1) continue;
    const key = trimmed.slice(0, cut).trim();
    let value = trimmed.slice(cut + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) parseEnv(fs.readFileSync(file, "utf8"));
  }
  return {
    supabaseUrl:
      process.env.NODE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://gzeeofbhcgbgcbykdvez.supabase.co",
    supabaseAnonKey:
      process.env.NODE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "sb_publishable_LCBgN5P6X2QlS-2igEw-NA_1VuKV4Rk",
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  };
}

export { root };
