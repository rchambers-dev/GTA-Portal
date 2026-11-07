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

  it("names the empty Portal tables and private bucket in the unapplied migration", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/035_review_assistant_store.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE public.app_state");
    expect(sql).toContain("payload jsonb DEFAULT '{}'::jsonb NOT NULL");
    expect(sql).toContain("CREATE TABLE public.app_state_history");
    expect(sql).toContain("GENERATED ALWAYS AS IDENTITY");
    expect(sql).toContain("CREATE INDEX app_state_history_saved_at_desc");
    expect(sql).toContain("CREATE TABLE public.tutor_reword_rate");
    expect(sql).toContain("reviews_private.save_app_state_if_version");
    expect(sql).toContain("reviews_private.record_app_state_history");
    expect(sql).toContain("reviews_private.rate_limit_hit");
    expect(sql).toContain("'review-app', 'review-app', false, 52428800");
    expect(sql).toContain("'review-attachments', 'review-attachments', false, 26214400");
    expect(sql).toContain(REVIEW_ATTACHMENT_BUCKET);
    expect(sql).not.toMatch(/create\s+(or replace\s+)?function\s+public\.staff_password_change_default/i);
    expect(sql).not.toMatch(/create\s+(or replace\s+)?function\s+public\.is_admin/i);
    expect(sql).not.toMatch(/on\s+auth\.users/i);
    expect(sql).not.toMatch(/create\s+(or replace\s+)?function\s+public\.rls_auto_enable/i);
    const structure = sql.split("-- SECTION B")[0]?.toLowerCase() ?? "";
    expect(structure).not.toContain("insert into public.app_state");
    const rollback = readFileSync(
      path.join(process.cwd(), "supabase/migrations/035_review_assistant_store_rollback.sql"),
      "utf8",
    );
    expect(rollback).toContain("DROP TABLE IF EXISTS public.app_state");
    expect(rollback).toContain("DROP SCHEMA IF EXISTS reviews_private");
  });
});
