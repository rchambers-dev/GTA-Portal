import { describe, expect, it } from "vitest";
import { readSupabaseConfig } from "./config";

function jwt(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.sig`;
}

const url = "https://example.supabase.co/";

describe("Supabase app config", () => {
  it("reads the public URL and anon key", () => {
    expect(
      readSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "anon" }),
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: jwt({ role: "anon" }),
    });
  });

  it("accepts a publishable key that is not a JWT", () => {
    expect(
      readSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_example",
      })?.anonKey,
    ).toBe("sb_publishable_example");
  });

  it("refuses a service-role key", () => {
    expect(
      readSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "service_role" }),
      }),
    ).toBeNull();
  });

  it("refuses a missing URL or key", () => {
    expect(readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: url })).toBeNull();
    expect(readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon" })).toBeNull();
  });
});
