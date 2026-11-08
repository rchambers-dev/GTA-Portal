import { describe, expect, it } from "vitest";
import { commitReviewAttachment, prepareReviewAttachment } from "./attachment-binding";
import { getReviewRepository } from "./repository";

describe("review attachment binding", () => {
  it("keeps a non-UUID review learner id and rejects HTML before any upload", async () => {
    const calls: string[] = [];
    const objects = new Map<string, Buffer>();
    const rows = new Map<string, string>();
    const transport = {
      async upload(path: string, bytes: Buffer) {
        calls.push(`upload:${path}`);
        objects.set(path, bytes);
      },
      async remove(path: string) {
        calls.push(`remove:${path}`);
        objects.delete(path);
      },
    };
    const prepared = prepareReviewAttachment({
      filename: "visit-note.pdf",
      type: "application/pdf",
      bytes: Buffer.from("%PDF-1.4"),
      actorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      learnerId: "review-learner-42",
    });
    expect(prepared.reviewLearnerId).toBe("review-learner-42");
    expect(prepared.portalApprenticeId).toBeNull();
    await commitReviewAttachment(prepared, transport, async (row) => {
      rows.set(row.id, row.reviewLearnerId);
    });
    expect(rows.get(prepared.id)).toBe("review-learner-42");
    expect(objects.has(prepared.id)).toBe(true);
    expect(() =>
      prepareReviewAttachment({
        filename: "page.html",
        type: "text/html",
        bytes: Buffer.from("<html></html>"),
        actorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        learnerId: "review-learner-42",
      }),
    ).toThrow(/PDF or image/);
    expect(calls.some((call) => call.includes("html"))).toBe(false);

    const failed = prepareReviewAttachment({
      filename: "second.pdf",
      type: "application/pdf",
      bytes: Buffer.from("%PDF-1.4"),
      actorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      learnerId: "review-learner-42",
    });
    await expect(
      commitReviewAttachment(failed, transport, async () => {
        throw new Error("metadata failed");
      }),
    ).rejects.toThrow(/metadata failed/);
    expect(objects.has(failed.id)).toBe(false);

    const stuck = prepareReviewAttachment({
      filename: "third.pdf",
      type: "application/pdf",
      bytes: Buffer.from("%PDF-1.4"),
      actorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      learnerId: "review-learner-42",
    });
    await expect(
      commitReviewAttachment(
        stuck,
        {
          upload: transport.upload,
          async remove() {
            throw new Error("remove failed");
          },
        },
        async () => {
          throw new Error("metadata failed");
        },
      ),
    ).rejects.toMatchObject({
      orphan: { bucket: "review-attachments", path: stuck.id },
    });
  });

  it("uses the Supabase adapter when both database settings are present", () => {
    const previousDatabase = process.env.REVIEW_DATABASE_URL;
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousMode = process.env.REVIEW_ASSISTANT_STORE;
    const previousVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    process.env.REVIEW_DATABASE_URL = "postgres://local/review";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    delete process.env.REVIEW_ASSISTANT_STORE;
    expect(getReviewRepository().kind).toBe("supabase");
    process.env.REVIEW_ASSISTANT_STORE = "postgres";
    expect(() => getReviewRepository()).toThrow(/not configured/);
    delete process.env.VERCEL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.REVIEW_ASSISTANT_STORE = "postgres";
    expect(getReviewRepository().kind).toBe("postgres");
    if (previousDatabase) process.env.REVIEW_DATABASE_URL = previousDatabase;
    else delete process.env.REVIEW_DATABASE_URL;
    if (previousUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    if (previousMode) process.env.REVIEW_ASSISTANT_STORE = previousMode;
    else delete process.env.REVIEW_ASSISTANT_STORE;
    if (previousVercel) process.env.VERCEL = previousVercel;
  });
});
