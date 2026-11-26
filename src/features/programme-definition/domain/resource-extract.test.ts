import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveExtractAbsolutePath } from "./resource-extract";

describe("evidence extract paths (DEV-230)", () => {
  const created: string[] = [];
  afterEach(() => {
    for (const file of created.splice(0)) fs.rmSync(file, { force: true });
  });

  it("rejects a resource id that leaves the extracts directory", () => {
    const outside = path.join(os.tmpdir(), `portal-secret-${process.pid}.txt`);
    fs.writeFileSync(outside, "secret");
    created.push(outside);
    expect(resolveExtractAbsolutePath(outside)).toBeNull();
    expect(resolveExtractAbsolutePath(path.resolve(process.cwd(), "../secret.txt"))).toBeNull();
    expect(resolveExtractAbsolutePath("tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/../../secret.txt")).toBeNull();
  });
});