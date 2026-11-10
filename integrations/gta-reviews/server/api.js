import { loadPayload } from "./db.js";
import { sendPreflight } from "./cors.js";
import { handleStateApi } from "./state-route.js";
import {
  buildReviewFormDocx,
  buildReviewFormPdf,
  reviewFormTemplateBytes,
  reviewFormWordTemplateBytes,
} from "./review-form.js";
import { readReviewAttachment, saveReviewAttachment } from "./attachments.js";
import { supabaseAdmin } from "./supabase-admin.js";
import { onVercel } from "./runtime.js";
import {
  ATTACH_BUCKET,
  authoritativeState,
  readRemoteState,
} from "./remote-state.js";
import { rewordTutorText } from "./tutor-ai.js";
import { allowReword } from "./reword-rate.js";
import { handlePasswordChanged } from "./password-flag.js";
import { addTutorFeedback, feedbackFailureBody, listTutorFeedback } from "./feedback.js";
import { logClientError } from "../shared/log-error.js";
import { tutorFromEmail } from "../src/tutors.js";
import { tutorLookupKey, normaliseTutor } from "../src/planner.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function sendError(res, error, route) {
  const status = error.status || 500;
  logClientError("API error", { status, code: error?.code, route });
  
  const clientMessage = 
    status === 401 || status === 403 || status === 400 || status === 409 || status === 429
      ? error.message
      : "An error occurred.";
  
  sendJson(res, status, { error: clientMessage });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const error = new Error("Invalid JSON.");
        error.status = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function readStoredAttachment(id) {
  try {
    return readReviewAttachment(id);
  } catch (error) {
    try {
      const { client } = supabaseAdmin();
      const downloaded = await client.storage.from(ATTACH_BUCKET).download(id);
      if (downloaded.error || !downloaded.data) throw downloaded.error || error;
      return {
        bytes: Buffer.from(await downloaded.data.arrayBuffer()),
        type: "application/pdf",
      };
    } catch {
      throw error;
    }
  }
}

async function canTutorAccessAttachment(auth, attachmentId) {
  if (!auth || !auth.role) return false;
  
  if (auth.role === "admin" || auth.role === "office") {
    return true;
  }
  
  if (auth.role !== "tutor") return false;
  
  const tutor = tutorFromEmail(auth.user?.email || "");
  if (!tutor) return false;
  
  const tutorKey = tutorLookupKey(tutor.name);
  
  let state = null;
  try {
    const { client } = supabaseAdmin();
    const fileState = await readRemoteState(client);
    const { data, error } = await client.from("app_state").select("payload").eq("id", "default").maybeSingle();
    if (error) throw error;
    state = authoritativeState(data?.payload ?? null, fileState, onVercel() ? null : loadPayload());
  } catch {
    return false;
  }
  
  if (!state) return false;
  
  const savedReviews = state.savedReviews || [];
  const review = savedReviews.find(
    (r) =>
      r.attachment?.id === attachmentId ||
      r.previousAttachment?.id === attachmentId ||
      r.returnedAttachment?.id === attachmentId
  );
  
  if (!review) {
    return false;
  }
  
  const learners = state.learners || [];
  const learner = learners.find((l) => l.id === review.learnerId);
  
  if (!learner) {
    return false;
  }
  
  const learnerTutorName = normaliseTutor(learner.tutor);
  const learnerTutorKey = tutorLookupKey(learnerTutorName);
  
  return learnerTutorKey === tutorKey;
}

function sendAttachment(res, { bytes, type, filename }) {
  res.statusCode = 200;
  res.setHeader("Content-Type", type || "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${String(filename || "review.pdf").replace(/"/g, "")}"`,
  );
  res.end(bytes);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function learnerAssignedToTutor(state, tutorKey, learnerId) {
  if (!state || !tutorKey || !learnerId) return false;
  const lists = [state.learners, state.followUps, state.archive];
  for (const list of lists) {
    const learner = (list || []).find((item) => item?.id === learnerId);
    if (!learner) continue;
    return tutorLookupKey(normaliseTutor(learner.tutor)) === tutorKey;
  }
  return false;
}

async function tutorMayUploadForLearner(auth, learnerId) {
  const tutor = tutorFromEmail(auth?.user?.email || "");
  if (!tutor || !learnerId) return false;
  const tutorKey = tutorLookupKey(tutor.name);
  let state = null;
  try {
    const { client } = supabaseAdmin();
    const fileState = await readRemoteState(client);
    const { data, error } = await client.from("app_state").select("payload").eq("id", "default").maybeSingle();
    if (error) throw error;
    state = authoritativeState(data?.payload ?? null, fileState, onVercel() ? null : loadPayload());
  } catch (error) {
    logClientError("Failed to load app state for upload check.", {
      status: error?.status,
      code: error?.code,
      route: "/api/review-attachment",
    });
    state = onVercel() ? null : loadPayload();
  }
  return learnerAssignedToTutor(state, tutorKey, learnerId);
}

export async function handleReviewApi(req, res, auth = null) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const pathname = url.pathname;

  if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
    sendPreflight(res);
    return true;
  }

  if (pathname.startsWith("/api/review-form")) {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end();
      return true;
    }
    if (pathname === "/api/review-form/template") {
      const bytes = reviewFormTemplateBytes();
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(bytes);
      return true;
    }
    if (pathname === "/api/review-form/word-template") {
      const bytes = reviewFormWordTemplateBytes();
      res.statusCode = 200;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(bytes);
      return true;
    }
    if (pathname === "/api/review-form/word") {
      const wordLearnerId = url.searchParams.get("id");
      if (!wordLearnerId) {
        sendJson(res, 400, { error: "Missing learner id." });
        return true;
      }
      try {
        const { bytes, filename } = await buildReviewFormDocx(wordLearnerId);
        res.statusCode = 200;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.end(bytes);
      } catch (error) {
        sendError(res, error, pathname);
      }
      return true;
    }
    const learnerId = url.searchParams.get("id");
    if (!learnerId) {
      sendJson(res, 400, { error: "Missing learner id." });
      return true;
    }
    try {
      const { bytes, filename } = await buildReviewFormPdf(learnerId, {
        reviewId: url.searchParams.get("review") || "",
        dateKey: url.searchParams.get("date") || "",
      });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.end(bytes);
    } catch (error) {
      sendError(res, error, pathname);
    }
    return true;
  }

  if (pathname.startsWith("/api/review-attachment")) {
    try {
      if (req.method === "GET") {
        const id = url.searchParams.get("id");
        if (!id) {
          sendJson(res, 400, { error: "Missing attachment id." });
          return true;
        }
        
        const canAccess = await canTutorAccessAttachment(auth, id);
        if (!canAccess) {
          sendJson(res, 403, { error: "Access denied. You can only access attachments for learners assigned to you." });
          return true;
        }
        
        const filename =
          String(url.searchParams.get("name") || id)
            .replace(/[<>:"/\\|?*]+/g, "")
            .replace(/\s+/g, "_")
            .slice(0, 80) || id;
        if (url.searchParams.get("json") === "1" || req.headers.accept?.includes("application/json")) {
          try {
            const { client } = supabaseAdmin();
            const signed = await client.storage.from(ATTACH_BUCKET).createSignedUrl(id, 3600);
            if (signed.data?.signedUrl) {
              sendJson(res, 200, { url: signed.data.signedUrl });
              return true;
            }
          } catch {
            // Fall through to stream the file instead.
          }
        }
        const stored = await readStoredAttachment(id);
        sendAttachment(res, { ...stored, filename });
        return true;
      }
      if (req.method === "POST") {
        if (url.searchParams.get("sign") === "1") {
          const { client } = supabaseAdmin();
          let filename = String(url.searchParams.get("name") || "review.pdf").trim();
          if (filename.length > 255) {
            sendJson(res, 400, { error: "Filename too long (max 255 characters)." });
            return true;
          }
          if (!/^[a-zA-Z0-9._\-\s]+$/.test(filename)) {
            sendJson(res, 400, { error: "Filename contains invalid characters." });
            return true;
          }
          const type = String(req.headers["content-type"] || "application/pdf").split(";")[0].trim();
          const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
          if (!allowedTypes.includes(type)) {
            sendJson(res, 400, { error: "Invalid file type. Only PDF and images allowed." });
            return true;
          }
          if (auth?.role === "tutor") {
            const learnerId = String(url.searchParams.get("learner") || "").trim();
            const allowed = await tutorMayUploadForLearner(auth, learnerId);
            if (!allowed) {
              sendJson(res, 403, {
                error: "Access denied. You can only upload reviews for learners assigned to you.",
              });
              return true;
            }
          }
          const id = `${crypto.randomUUID()}${filename.match(/\.[a-z0-9]+$/i)?.[0] || ".pdf"}`;
          const signed = await client.storage.from(ATTACH_BUCKET).createSignedUploadUrl(id);
          sendJson(res, 200, {
            upload: signed.data,
            attachment: { id, filename, type },
          });
          return true;
        }
        
        let filename = String(
          url.searchParams.get("name") ||
          req.headers["x-filename"] ||
          "review.pdf"
        ).trim();
        if (filename.length > 255) {
          sendJson(res, 400, { error: "Filename too long (max 255 characters)." });
          return true;
        }
        if (!/^[a-zA-Z0-9._\-\s]+$/.test(filename)) {
          sendJson(res, 400, { error: "Filename contains invalid characters." });
          return true;
        }
        
        const type = String(req.headers["content-type"] || "application/pdf").split(";")[0].trim();
        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(type)) {
          sendJson(res, 400, { error: "Invalid file type. Only PDF and images allowed." });
          return true;
        }
        
        const bytes = await readRawBody(req);
        const attachment = saveReviewAttachment({
          filename,
          type,
          bytes,
        });
        try {
          const { client } = supabaseAdmin();
          await client.storage.from(ATTACH_BUCKET).upload(attachment.id, bytes, {
            upsert: true,
            contentType: attachment.type,
          });
        } catch {
          // Local file is enough when Supabase is offline.
        }
        sendJson(res, 200, { attachment });
        return true;
      }
      res.statusCode = 405;
      res.end();
    } catch (error) {
      sendError(res, error, pathname);
    }
    return true;
  }

  if (pathname === "/api/feedback") {
    try {
      if (req.method === "GET") {
        sendJson(res, 200, { items: await listTutorFeedback() });
        return true;
      }
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        const items = await addTutorFeedback(body);
        sendJson(res, 200, { items });
        return true;
      }
      res.statusCode = 405;
      res.end();
    } catch (error) {
      logClientError("Feedback request failed", {
        status: error?.status,
        code: error?.code,
        route: "/api/feedback",
      });
      const body = feedbackFailureBody(error);
      sendJson(res, body.status, { error: body.error });
    }
    return true;
  }

  if (pathname === "/api/password-changed") {
    await handlePasswordChanged(req, res);
    return true;
  }

  if (pathname === "/api/tutor-reword") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return true;
    }
    try {
      const body = await readJsonBody(req);
      const source = String(body?.text || "");
      if (!source.trim()) {
        sendJson(res, 400, { error: "Write something in this box first." });
        return true;
      }
      if (source.length > 5000) {
        sendJson(res, 400, { error: "Text too long. Maximum 5000 characters allowed." });
        return true;
      }
      await allowReword(null);
      const text = await rewordTutorText(body);
      sendJson(res, 200, { text });
    } catch (error) {
      sendError(res, error, pathname);
    }
    return true;
  }

  if (!pathname.startsWith("/api/state")) return false;

  await handleStateApi(req, res);
  return true;
}
