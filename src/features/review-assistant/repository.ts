import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withDirectPg } from "@/lib/db/direct-pool";
import { canonicalActorId } from "@/lib/portal/actor-id";
import { commitReviewAttachment, prepareReviewAttachment } from "./attachment-binding";
import {
  readAttachmentBinding,
  readReviewAttachment,
  saveReviewAttachment,
} from "./attachments";
import { REVIEW_ATTACHMENT_BUCKET, REVIEW_DOCUMENT_ID } from "./repository-constants";
import {
  readReviewState,
  saveReviewState,
  type ReviewState,
} from "./state-store";
import { conflictBody, sameSavedContent, versionOf } from "./version-rules";

export { REVIEW_APP_BUCKET, REVIEW_ATTACHMENT_BUCKET, REVIEW_DOCUMENT_ID } from "./repository-constants";

export class ReviewStoreNotConfigured extends Error {
  status = 503;
  constructor() {
    super(
      "Review store is not configured. Production uses the Supabase adapter. REVIEW_ASSISTANT_STORE=postgres is a direct database mode and is refused in production. The file store is test-only.",
    );
  }
}

export type StoredAttachment = {
  id: string;
  filename: string;
  type: string;
  actorId: string;
  learnerId: string;
  portalApprenticeId?: string | null;
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
  kind: "memory" | "file" | "supabase" | "postgres";
  readDocument(): Promise<ReviewState>;
  saveDocument(next: ReviewState, expectedVersion: number, actorId: string): Promise<DocumentSave>;
  documentHistory(): Promise<HistoryEntry[]>;
  saveAttachment(input: {
    filename: string;
    type: string;
    bytes: Buffer;
    actorId: string;
    learnerId: string;
    portalApprenticeId?: string | null;
  }): Promise<StoredAttachment>;
  readAttachment(id: string): Promise<StoredAttachment>;
  attachmentBinding(id: string): Promise<{ actorId: string; learnerId: string; portalApprenticeId: string | null } | null>;
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
    return {
      actorId: found.actorId,
      learnerId: found.learnerId,
      portalApprenticeId: found.portalApprenticeId ?? null,
    };
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
  async saveDocument(next, expectedVersion): Promise<DocumentSave> {
    const result = saveReviewState(next, expectedVersion);
    if (result.status !== 200) return { status: 409, body: result.body };
    return {
      status: 200,
      body: {
        ok: true,
        unchanged: "unchanged" in result.body ? result.body.unchanged : undefined,
        version: Number(result.body.version) || expectedVersion,
        savedAt: String(result.body.savedAt || ""),
      },
    };
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
    return {
      actorId: binding.actorId,
      learnerId: binding.learnerId,
      portalApprenticeId: binding.portalApprenticeId ?? null,
    };
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
    const actor = canonicalActorId(actorId);
    const client = supabaseAdmin();
    const { data, error } = await client.rpc("save_app_state_if_version", {
      expected_version: expectedVersion,
      next_payload: saved,
      actor_id: actor,
    });
    if (error) throw reviewSaveError(error.message);
    if (Number(data) !== 1) {
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
    const prepared = prepareReviewAttachment(input);
    const client = supabaseAdmin();
    await commitReviewAttachment(
      prepared,
      {
        async upload(path, bytes, contentType) {
          const uploaded = await client.storage.from(REVIEW_ATTACHMENT_BUCKET).upload(path, bytes, {
            contentType,
            upsert: false,
          });
          if (uploaded.error) throw new ReviewStoreNotConfigured();
        },
        async remove(path) {
          const removed = await client.storage.from(REVIEW_ATTACHMENT_BUCKET).remove([path]);
          if (removed.error) throw removed.error;
        },
      },
      async (row) => {
        const { error } = await client.from("review_assistant_attachments").insert({
          id: row.id,
          review_learner_id: row.reviewLearnerId,
          portal_apprentice_id: row.portalApprenticeId,
          actor_id: canonicalActorId(row.actorId),
          filename: row.filename,
          content_type: row.type,
          size_bytes: row.bytes.length,
          storage_bucket: REVIEW_ATTACHMENT_BUCKET,
          storage_path: row.id,
        });
        if (error) throw new ReviewStoreNotConfigured();
      },
    );
    return {
      id: prepared.id,
      filename: prepared.filename,
      type: prepared.type,
      actorId: prepared.actorId,
      learnerId: prepared.reviewLearnerId,
    };
  },
  async readAttachment(id) {
    const client = supabaseAdmin();
    const { data, error } = await client
      .from("review_assistant_attachments")
      .select("id, actor_id, review_learner_id, filename, content_type, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error || !data?.review_learner_id) {
      throw Object.assign(new Error("Attached review not found."), { status: 404 });
    }
    const downloaded = await client.storage.from(REVIEW_ATTACHMENT_BUCKET).download(data.storage_path);
    if (downloaded.error || !downloaded.data) {
      throw Object.assign(new Error("Attached review not found."), { status: 404 });
    }
    return {
      id: data.id,
      filename: data.filename,
      type: data.content_type,
      actorId: data.actor_id,
      learnerId: String(data.review_learner_id),
      bytes: Buffer.from(await downloaded.data.arrayBuffer()),
    };
  },
  async attachmentBinding(id) {
    const client = supabaseAdmin();
    const { data, error } = await client
      .from("review_assistant_attachments")
      .select("actor_id, review_learner_id, portal_apprentice_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !data?.actor_id || !data.review_learner_id) return null;
    return {
      actorId: String(data.actor_id),
      learnerId: String(data.review_learner_id),
      portalApprenticeId: data.portal_apprentice_id ? String(data.portal_apprentice_id) : null,
    };
  },
};

function reviewSaveError(message: string) {
  if (/must equal the expected version plus one/i.test(message)) {
    return Object.assign(new Error("Review version must move forward by one."), { status: 400 });
  }
  if (/not a Portal profile/i.test(message)) {
    return Object.assign(new Error("Review actor is not a Portal profile."), { status: 400 });
  }
  return new ReviewStoreNotConfigured();
}

type QueryResult = { rows: Array<Record<string, unknown>> };
type Queryable = { query: (sql: string, params?: unknown[]) => Promise<QueryResult> };

async function withReviewPostgres<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  if (!process.env.REVIEW_DATABASE_URL?.trim()) throw new ReviewStoreNotConfigured();
  try {
    return await withDirectPg(fn);
  } catch (error) {
    if (error instanceof ReviewStoreNotConfigured) throw error;
    const status = (error as { status?: number }).status;
    if (status === 400 || status === 409 || status === 500) throw error;
    throw reviewSaveError(error instanceof Error ? error.message : "");
  }
}

async function readPostgresDocument(db: Queryable): Promise<ReviewState> {
  const result = await db.query(
    "select payload, updated_at from public.app_state where id = $1",
    [REVIEW_DOCUMENT_ID],
  );
  const row = result.rows[0];
  if (!row) return emptyDocument();
  const payload = (row.payload || {}) as ReviewState;
  payload.version = versionOf(payload);
  payload.savedAt = String(row.updated_at || "");
  return payload;
}

export const postgresReviewRepository: ReviewRepository = {
  kind: "postgres",
  readDocument() {
    return withReviewPostgres(readPostgresDocument);
  },
  async saveDocument(next, expectedVersion, actorId) {
    const actor = canonicalActorId(actorId);
    return withReviewPostgres(async (db) => {
      const stored = await readPostgresDocument(db);
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
      try {
        const result = await db.query(
          "select public.save_app_state_if_version($1, $2::jsonb, $3::uuid) as saved",
          [expectedVersion, JSON.stringify(saved), actor],
        );
        if (Number(result.rows[0]?.saved) !== 1) {
          const latest = await readPostgresDocument(db);
          return { status: 409, body: conflictBody(expectedVersion, versionOf(latest), latest) };
        }
        return { status: 200, body: { ok: true, version: versionOf(saved), savedAt: saved.savedAt || "" } };
      } catch (error) {
        throw reviewSaveError(error instanceof Error ? error.message : "");
      }
    });
  },
  async documentHistory() {
    return withReviewPostgres(async (db) => {
      const result = await db.query(
        "select version, payload, saved_at, user_id from public.app_state_history order by saved_at asc, id asc",
      );
      return result.rows.map((row) => ({
        version: Number(row.version),
        payload: row.payload as ReviewState,
        savedAt: String(row.saved_at || ""),
        actorId: String(row.user_id || ""),
      }));
    });
  },
  async saveAttachment() {
    throw new ReviewStoreNotConfigured();
  },
  async readAttachment() {
    throw new ReviewStoreNotConfigured();
  },
  async attachmentBinding(id) {
    return withReviewPostgres(async (db) => {
      const result = await db.query(
        "select actor_id, review_learner_id, portal_apprentice_id from public.review_assistant_attachments where id = $1",
        [id],
      );
      const row = result.rows[0];
      if (!row?.actor_id || !row.review_learner_id) return null;
      return {
        actorId: String(row.actor_id),
        learnerId: String(row.review_learner_id),
        portalApprenticeId: row.portal_apprentice_id ? String(row.portal_apprentice_id) : null,
      };
    });
  },
};

export function getReviewRepository(): ReviewRepository {
  const mode = process.env.REVIEW_ASSISTANT_STORE;
  const production = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (mode === "memory" || mode === "file") {
    if (production) throw new ReviewStoreNotConfigured();
    return mode === "memory" ? memoryReviewRepository : fileReviewRepository;
  }
  if (mode === "postgres") {
    if (production || !process.env.REVIEW_DATABASE_URL?.trim()) throw new ReviewStoreNotConfigured();
    return postgresReviewRepository;
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return supabaseReviewRepository;
  }
  if (!production && process.env.REVIEW_DATABASE_URL?.trim()) return postgresReviewRepository;
  throw new ReviewStoreNotConfigured();
}
