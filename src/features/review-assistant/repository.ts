import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { conflictBody, sameSavedContent, versionOf } from "./version-rules";
import {
  readReviewState,
  saveReviewState,
  type ReviewState,
} from "./state-store";
import {
  readAttachmentBinding,
  readReviewAttachment,
  saveReviewAttachment,
} from "./attachments";

export const REVIEW_ATTACHMENT_BUCKET = "review-attachments";
export const REVIEW_APP_BUCKET = "review-app";
export const REVIEW_DOCUMENT_ID = "default";

export class ReviewStoreNotConfigured extends Error {
  status = 503;
  constructor() {
    super(
      "Review store is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then apply the reviewed supabase/migrations/035_review_assistant_store.sql. The file store is test-only.",
    );
  }
}

export type StoredAttachment = {
  id: string;
  filename: string;
  type: string;
  actorId: string;
  learnerId: string;
  bytes?: Buffer;
};

export type DocumentSave =
  | { status: 200; body: { ok: true; unchanged?: boolean; version: number; savedAt: string } }
  | { status: 409; body: ReturnType<typeof conflictBody> };

export type HistoryEntry = {
  version: number;
  payload: ReviewState;
  savedAt: string;
  actorId: string;
};

export interface ReviewRepository {
  kind: "memory" | "file" | "supabase";
  readDocument(): Promise<ReviewState>;
  saveDocument(next: ReviewState, expectedVersion: number, actorId: string): Promise<DocumentSave>;
  documentHistory(): Promise<HistoryEntry[]>;
  saveAttachment(input: {
    filename: string;
    type: string;
    bytes: Buffer;
    actorId: string;
    learnerId: string;
  }): Promise<StoredAttachment>;
  readAttachment(id: string): Promise<StoredAttachment>;
  attachmentBinding(id: string): Promise<{ actorId: string; learnerId: string } | null>;
}

const memoryDocuments = new Map<string, { current: ReviewState; history: HistoryEntry[] }>();
const memoryAttachments = new Map<string, StoredAttachment>();
let memoryQueue: Promise<unknown> = Promise.resolve();

function emptyDocument(): ReviewState {
  return {
    version: 1,
    savedAt: "",
    learners: [],
    savedReviews: [],
    followUps: [],
    archive: [],
    analyticsEvents: [],
    settings: {},
    tutorFeedback: [],
  };
}

function enqueueMemory<T>(work: () => Promise<T>): Promise<T> {
  const run = memoryQueue.then(work, work);
  memoryQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export const memoryReviewRepository: ReviewRepository = {
  kind: "memory",
  async readDocument() {
    return memoryDocuments.get(REVIEW_DOCUMENT_ID)?.current ?? emptyDocument();
  },
  saveDocument(next, expectedVersion, actorId) {
    return enqueueMemory(async () => {
      const stored = memoryDocuments.get(REVIEW_DOCUMENT_ID)?.current ?? emptyDocument();
      const storedVersion = versionOf(stored);
      if (expectedVersion !== storedVersion) {
        return { status: 409 as const, body: conflictBody(expectedVersion, storedVersion, stored) };
      }
      if (sameSavedContent(next, stored)) {
        return {
          status: 200 as const,
          body: { ok: true as const, unchanged: true, version: storedVersion, savedAt: stored.savedAt || "" },
        };
      }
      const history = memoryDocuments.get(REVIEW_DOCUMENT_ID)?.history ?? [];
      history.push({
        version: storedVersion,
        payload: stored,
        savedAt: stored.savedAt || new Date().toISOString(),
        actorId,
      });
      const saved: ReviewState = {
        ...next,
        version: storedVersion + 1,
        savedAt: new Date().toISOString(),
      };
      delete saved.appBuild;
      memoryDocuments.set(REVIEW_DOCUMENT_ID, { current: saved, history });
      return {
        status: 200 as const,
        body: { ok: true as const, version: saved.version || storedVersion + 1, savedAt: saved.savedAt || "" },
      };
    });
  },
  async documentHistory() {
    return memoryDocuments.get(REVIEW_DOCUMENT_ID)?.history ?? [];
  },
  async saveAttachment(input) {
    if (!input.actorId || !input.learnerId) {
      throw Object.assign(new Error("Attachment must be bound to a learner."), { status: 400 });
    }
    const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(input.type) || input.bytes.length === 0 || input.bytes.length > 20 * 1024 * 1024) {
      throw Object.assign(new Error("Attach a PDF or image of the review."), { status: 400 });
    }
    const id = `${crypto.randomUUID()}.pdf`;
    const record: StoredAttachment = { ...input, id };
    memoryAttachments.set(id, record);
    return record;
  },
  async readAttachment(id) {
    const found = memoryAttachments.get(id);
    if (!found?.bytes) throw Object.assign(new Error("Attached review not found."), { status: 404 });
    return found;
  },
  async attachmentBinding(id) {
    const found = memoryAttachments.get(id);
    if (!found) return null;
    return { actorId: found.actorId, learnerId: found.learnerId };
  },
};

export function resetMemoryReviewRepository() {
  memoryDocuments.clear();
  memoryAttachments.clear();
  memoryQueue = Promise.resolve();
}

const fileReviewRepository: ReviewRepository = {
  kind: "file",
  async readDocument() {
    return readReviewState();
  },
  async saveDocument(next, expectedVersion) {
    return saveReviewState(next, expectedVersion);
  },
  async documentHistory() {
    return [];
  },
  async saveAttachment(input) {
    const saved = saveReviewAttachment(input);
    return saved;
  },
  async readAttachment(id) {
    const stored = readReviewAttachment(id);
    const binding = readAttachmentBinding(id);
    if (!binding) throw Object.assign(new Error("Attached review not found."), { status: 404 });
    return { ...binding, filename: id, type: stored.type, bytes: stored.bytes };
  },
  async attachmentBinding(id) {
    const binding = readAttachmentBinding(id);
    if (!binding) return null;
    return { actorId: binding.actorId, learnerId: binding.learnerId };
  },
};

function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new ReviewStoreNotConfigured();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const supabaseReviewRepository: ReviewRepository = {
  kind: "supabase",
  async readDocument() {
    const client = supabaseAdmin();
    const { data, error } = await client
      .from("app_state")
      .select("payload, updated_at")
      .eq("id", REVIEW_DOCUMENT_ID)
      .maybeSingle();
    if (error) throw new ReviewStoreNotConfigured();
    if (!data) return emptyDocument();
    const payload = (data.payload || {}) as ReviewState;
    payload.version = versionOf(payload);
    payload.savedAt = data.updated_at || "";
    return payload;
  },
  async saveDocument(next, expectedVersion, actorId) {
    const stored = await this.readDocument();
    const storedVersion = versionOf(stored);
    if (expectedVersion !== storedVersion) {
      return { status: 409, body: conflictBody(expectedVersion, storedVersion, stored) };
    }
    if (sameSavedContent(next, stored)) {
      return {
        status: 200,
        body: { ok: true, unchanged: true, version: storedVersion, savedAt: stored.savedAt || "" },
      };
    }
    const saved: ReviewState = { ...next, version: storedVersion + 1, savedAt: new Date().toISOString() };
    delete saved.appBuild;
    const client = supabaseAdmin();
    const actor = /^[0-9a-f-]{36}$/i.test(actorId) ? actorId : null;
    const { data, error } = await client.schema("reviews_private").rpc("save_app_state_if_version", {
      expected_version: expectedVersion,
      next_payload: saved,
      actor_id: actor,
    });
    if (error) throw new ReviewStoreNotConfigured();
    if (data !== 1) {
      const latest = await this.readDocument();
      return { status: 409, body: conflictBody(expectedVersion, versionOf(latest), latest) };
    }
    return { status: 200, body: { ok: true, version: versionOf(saved), savedAt: saved.savedAt || "" } };
  },
  async documentHistory() {
    const client = supabaseAdmin();
    const { data, error } = await client
      .from("app_state_history")
      .select("version, payload, saved_at, user_id")
      .order("saved_at", { ascending: true });
    if (error) throw new ReviewStoreNotConfigured();
    return (data ?? []).map((row) => ({
      version: Number(row.version),
      payload: row.payload as ReviewState,
      savedAt: String(row.saved_at || ""),
      actorId: String(row.user_id || ""),
    }));
  },
  async saveAttachment(input) {
    if (!input.actorId || !input.learnerId) {
      throw Object.assign(new Error("Attachment must be bound to a learner."), { status: 400 });
    }
    if (input.bytes.length > 20 * 1024 * 1024) {
      throw Object.assign(new Error("That file is too large to attach."), { status: 400 });
    }
    const id = `${crypto.randomUUID()}${input.filename.toLowerCase().endsWith(".pdf") ? ".pdf" : ""}`;
    const client = supabaseAdmin();
    const uploaded = await client.storage.from(REVIEW_ATTACHMENT_BUCKET).upload(id, input.bytes, {
      contentType: input.type,
      upsert: false,
    });
    if (uploaded.error) throw new ReviewStoreNotConfigured();
    const { error } = await client.from("review_assistant_attachments").insert({
      id,
      portal_apprentice_id: /^[0-9a-f-]{36}$/i.test(input.learnerId) ? input.learnerId : null,
      actor_id: input.actorId,
      filename: input.filename,
      content_type: input.type,
      size_bytes: input.bytes.length,
      storage_bucket: REVIEW_ATTACHMENT_BUCKET,
      storage_path: id,
    });
    if (error) throw new ReviewStoreNotConfigured();
    return { id, filename: input.filename, type: input.type, actorId: input.actorId, learnerId: input.learnerId };
  },
  async readAttachment(id) {
    const client = supabaseAdmin();
    const { data, error } = await client
      .from("review_assistant_attachments")
      .select("id, actor_id, portal_apprentice_id, filename, content_type, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) throw Object.assign(new Error("Attached review not found."), { status: 404 });
    const downloaded = await client.storage.from(REVIEW_ATTACHMENT_BUCKET).download(data.storage_path);
    if (downloaded.error || !downloaded.data) {
      throw Object.assign(new Error("Attached review not found."), { status: 404 });
    }
    return {
      id: data.id,
      filename: data.filename,
      type: data.content_type,
      actorId: data.actor_id,
      learnerId: data.portal_apprentice_id || "",
      bytes: Buffer.from(await downloaded.data.arrayBuffer()),
    };
  },
  async attachmentBinding(id) {
    const client = supabaseAdmin();
    const { data, error } = await client
      .from("review_assistant_attachments")
      .select("actor_id, portal_apprentice_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !data?.actor_id) return null;
    return { actorId: String(data.actor_id), learnerId: String(data.portal_apprentice_id || "") };
  },
};

export function getReviewRepository(): ReviewRepository {
  const mode = process.env.REVIEW_ASSISTANT_STORE;
  const production = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (mode === "memory" || mode === "file") {
    if (production) throw new ReviewStoreNotConfigured();
    return mode === "memory" ? memoryReviewRepository : fileReviewRepository;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new ReviewStoreNotConfigured();
  }
  return supabaseReviewRepository;
}
