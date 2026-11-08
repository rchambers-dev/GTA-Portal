import { afterEach, describe, expect, it } from "vitest";
import {
  getReviewRepository,
  memoryReviewRepository,
  resetMemoryReviewRepository,
  ReviewStoreNotConfigured,
  REVIEW_ATTACHMENT_BUCKET,
} from "./repository";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("durable review store", () => {
  afterEach(() => {
    resetMemoryReviewRepository();
    delete process.env.REVIEW_ASSISTANT_STORE;
  });

  it("fails closed when production storage is not configured", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.REVIEW_ASSISTANT_STORE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getReviewRepository()).toThrow(ReviewStoreNotConfigured);
    process.env.REVIEW_ASSISTANT_STORE = "file";
    process.env.VERCEL = "1";
    expect(() => getReviewRepository()).toThrow(ReviewStoreNotConfigured);
    delete process.env.VERCEL;
    if (previousUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });

  it("keeps the previous version when two saves race and reloads it after", async () => {
    process.env.REVIEW_ASSISTANT_STORE = "memory";
    const repo = getReviewRepository();
    expect(repo.kind).toBe("memory");
    const first = repo.saveDocument(
      { learners: [{ id: "11111111-1111-1111-1111-111111111111", name: "Example Learner" }] },
      1,
      "actor-a",
    );
    const second = repo.saveDocument(
      { learners: [{ id: "11111111-1111-1111-1111-111111111111", name: "Other" }] },
      1,
      "actor-b",
    );
    const [saved, conflict] = await Promise.all([first, second]);
    const statuses = [saved.status, conflict.status].sort();
    expect(statuses).toEqual([200, 409]);
    const current = await repo.readDocument();
    expect(current.learners?.[0]?.name).toBe("Example Learner");
    const history = await repo.documentHistory();
    expect(history.map((entry) => entry.version)).toEqual([1]);
    expect(history[0]?.payload.learners).toEqual([]);
  });

  it("isolates an attachment to the learner it was stored with", async () => {
    const saved = await memoryReviewRepository.saveAttachment({
      filename: "example.pdf",
      type: "application/pdf",
      bytes: Buffer.from("%PDF-1.4"),
      actorId: "22222222-2222-2222-2222-222222222222",
      learnerId: "33333333-3333-3333-3333-333333333333",
    });
    const binding = await memoryReviewRepository.attachmentBinding(saved.id);
    expect(binding).toEqual({
      actorId: "22222222-2222-2222-2222-222222222222",
      learnerId: "33333333-3333-3333-3333-333333333333",
    });
    const loaded = await memoryReviewRepository.readAttachment(saved.id);
    expect(loaded.bytes?.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("keeps the source-shaped structure separate from the callable portal additions", () => {
    const structure = readFileSync(
      path.join(process.cwd(), "supabase/migrations/035_review_assistant_store.sql"),
      "utf8",
    );
    const portal = readFileSync(
      path.join(process.cwd(), "supabase/migrations/036_review_assistant_portal.sql"),
      "utf8",
    );
    const adapter = readFileSync(path.join(process.cwd(), "src/features/review-assistant/repository.ts"), "utf8");
    expect(structure).toContain("CREATE TABLE public.app_state");
    expect(structure).toContain("payload jsonb DEFAULT '{}'::jsonb NOT NULL");
    expect(structure).toContain("CREATE TABLE public.app_state_history");
    expect(structure).toContain("GENERATED ALWAYS AS IDENTITY");
    expect(structure).toContain("CREATE INDEX app_state_history_saved_at_desc");
    expect(structure).toContain("CREATE TABLE public.tutor_reword_rate");
    expect(structure).not.toContain("save_app_state_if_version");
    expect(structure).not.toContain("storage.buckets");
    expect(portal).toContain("CREATE FUNCTION public.save_app_state_if_version");
    expect(portal).toContain("SECURITY INVOKER");
    expect(portal).toContain("expected_version + 1");
    expect(portal).toContain("interval '30 days'");
    expect(portal).toContain("OFFSET 500");
    expect(portal).toContain("REVOKE ALL ON FUNCTION reviews_private.record_app_state_history(uuid, integer, jsonb)");
    expect(portal).not.toContain("GRANT EXECUTE ON FUNCTION reviews_private.record_app_state_history");
    expect(portal).not.toContain("save_app_state_if_version(\n  expected_version integer,\n  next_payload jsonb\n)");
    expect(portal).toContain("incompatible settings");
    expect(portal).toContain(REVIEW_ATTACHMENT_BUCKET);
    expect(portal).not.toMatch(/^\s*(alter|set)\s+.*pgrst/im);
    expect(portal).not.toMatch(/create\s+(or replace\s+)?function\s+public\.is_admin/i);
    expect(adapter).not.toContain('.schema("reviews_private")');
    const manifest = readFileSync(path.join(process.cwd(), "supabase/migrations/REVIEW_SQL_SHA256.txt"), "utf8");
    expect(manifest).toContain("283720831f5fd05170212dd3b637eecf135498c176a20e48fd49ae01cf70654d");
    expect(manifest).toContain("e2b3acd0bcd35031b33e1ac98b95319dcca2563829906e9fc6dcb68b28f65e78");
    expect(adapter).toContain('client.rpc("save_app_state_if_version"');
    expect(adapter).toContain("public.save_app_state_if_version");
    const structureRollback = readFileSync(
      path.join(process.cwd(), "supabase/migrations/035_review_assistant_store_rollback.sql"),
      "utf8",
    );
    const portalRollback = readFileSync(
      path.join(process.cwd(), "supabase/migrations/036_review_assistant_portal_rollback.sql"),
      "utf8",
    );
    expect(structureRollback).toContain("rollback refused: public.app_state holds rows");
    expect(portalRollback).toContain("rollback refused: a Reviews bucket holds objects");
    expect(portalRollback).toContain("created_by_this_migration = true");
  });
});
