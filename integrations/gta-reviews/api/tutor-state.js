import { supabaseAdmin } from "../server/supabase-admin.js";
import { loadPayload } from "../server/db.js";
import { onVercel } from "../server/runtime.js";
import { authoritativeState, readRemoteState } from "../server/remote-state.js";
import {
  commitVersionedState,
  conflictBody,
  isOutdatedBuild,
  outdatedBuildBody,
  readAppStatePayload,
  sameSavedContent,
  versionOf,
} from "../server/app-state.js";
import { sendPreflight } from "../server/cors.js";
import { staffRole } from "../server/roles.js";
import { logClientError } from "../shared/log-error.js";
import { tutorFromEmail } from "../src/tutors.js";
import { tutorLookupKey, normaliseTutor } from "../src/planner.js";
import { mergeLearnerRecords, mergePreservedPlanLocks } from "../src/plan-locks.js";

const TUTOR_ROLE = "tutor";

const TUTOR_WRITABLE_REVIEW_FIELDS = new Set([
  "status",
  "targets",
  "progress",
  "evidence",
  "achievedHours",
  "otjHours",
  "notPresent",
  "notPresentReason",
  "returnedAttachment",
  "tutorNotes",
  "tutorSignature",
  "tutorSignedAt",
]);

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function requireTutor(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }

  try {
    const { client } = supabaseAdmin();
    const { data, error: authError } = await client.auth.getUser(token);

    if (authError || !data?.user) {
      const error = new Error("Invalid or expired token.");
      error.status = 401;
      throw error;
    }

    const role = staffRole(data.user);
    if (role !== TUTOR_ROLE) {
      const error = new Error("Access denied. Tutor role required.");
      error.status = 403;
      throw error;
    }

    const tutor = tutorFromEmail(data.user.email);
    if (!tutor) {
      const error = new Error("Tutor record not found for this email.");
      error.status = 403;
      throw error;
    }

    return { user: data.user, tutor };
  } catch (error) {
    if (error.status) throw error;
    const authError = new Error("Authentication failed.");
    authError.status = 401;
    throw authError;
  }
}

function tutorConflictBody(clientVersion, storedVersion, stored, tutorKey) {
  return conflictBody(
    clientVersion,
    storedVersion,
    stored ? filterStateForTutor(stored, tutorKey) : null,
  );
}

function filterStateForTutor(state, tutorKey) {
  if (!state) return null;

  const filtered = { ...state };
  
  filtered.learners = (state.learners || []).filter((learner) => {
    const learnerTutorKey = tutorLookupKey(normaliseTutor(learner.tutor));
    return learnerTutorKey === tutorKey;
  });

  const learnerIds = new Set(filtered.learners.map((l) => l.id));

  filtered.savedReviews = (state.savedReviews || []).filter((review) =>
    learnerIds.has(review.learnerId)
  );

  filtered.followUps = (state.followUps || []).filter((learner) => {
    const learnerTutorKey = tutorLookupKey(normaliseTutor(learner.tutor));
    return learnerTutorKey === tutorKey;
  });

  filtered.archive = (state.archive || []).filter((learner) => {
    const learnerTutorKey = tutorLookupKey(normaliseTutor(learner.tutor));
    return learnerTutorKey === tutorKey;
  });

  filtered.analyticsEvents = (state.analyticsEvents || []).filter((event) =>
    learnerIds.has(event.learnerId)
  );

  filtered.settings = {
    ...state.settings,
    email: "",
    officePostcode: "",
    workingDates: [],
    plannedDatesCleared: false,
    blockedTutors: [],
    customTutors: [],
  };

  filtered.acceptedRoutes = {};
  filtered.verifiedByDate = {};
  filtered.callAnchors = {};
  filtered.pinnedRoutes = {};
  filtered.frozenTimes = {};
  filtered.excludedFromDate = {};
  filtered.completedRoutes = {};
  filtered.awaitingReply = {};
  filtered.awaitingClearedAt = {};
  filtered.visitDays = {};
  filtered.tutorFeedback = [];

  return filtered;
}

function validateTutorReviewUpdate(update, existingReview) {
  const validated = {};
  
  for (const field of TUTOR_WRITABLE_REVIEW_FIELDS) {
    if (field in update) {
      validated[field] = update[field];
    }
  }

  if (Object.keys(validated).length === 0) {
    const error = new Error("No valid fields to update.");
    error.status = 400;
    throw error;
  }

  return { ...existingReview, ...validated };
}

function mergeTutorUpdates(fullState, updates, tutorKey) {
  const learnerIds = new Set(
    (fullState.learners || [])
      .filter((l) => tutorLookupKey(normaliseTutor(l.tutor)) === tutorKey)
      .map((l) => l.id)
  );

  if (updates.savedReviews) {
    const reviewsById = new Map(
      (fullState.savedReviews || []).map((r) => [r.id, r])
    );

    for (const update of updates.savedReviews || []) {
      if (!update.id) continue;
      const existing = reviewsById.get(update.id);
      if (!existing || !learnerIds.has(existing.learnerId)) continue;
      
      const validated = validateTutorReviewUpdate(update, existing);
      reviewsById.set(update.id, validated);
    }

    fullState.savedReviews = Array.from(reviewsById.values());
  }

  return fullState;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendPreflight(res);
    return;
  }
  try {
    const { user, tutor } = await requireTutor(req);
    const tutorKey = tutorLookupKey(tutor.name);

    const local = onVercel() ? null : loadPayload();

    if (req.method === "GET") {
      let stored = local;

      try {
        const { client } = supabaseAdmin();
        const fileState = await readRemoteState(client);
        const result = await client.from("app_state").select("payload").eq("id", "default").maybeSingle();
        if (result?.error) throw result.error;
        stored = authoritativeState(result?.data?.payload ?? null, fileState, local);
      } catch (error) {
        logClientError("Failed to load state for tutor.", {
          status: 503,
          code: error?.code,
          route: "/api/tutor-state",
        });
        sendJson(res, 503, { error: "Could not read the stored state. Try again." });
        return;
      }

      const filtered = filterStateForTutor(stored, tutorKey);
      sendJson(res, 200, { state: filtered });
      return;
    }

    if (req.method === "POST" || req.method === "PATCH") {
      const updates = await readJsonBody(req);
      const clientBuild = updates.appBuild;
      delete updates.appBuild;
      if (isOutdatedBuild(clientBuild)) {
        sendJson(res, 426, outdatedBuildBody());
        return;
      }
      const clientVersion = Number(updates.version) || 1;

      const existing = local;
      let stored = null;

      try {
        const read = await readAppStatePayload();
        stored = read.payload;
      } catch (error) {
        logClientError("Failed to load stored state for tutor update.", {
          status: 503,
          code: error?.code,
          route: "/api/tutor-state",
        });
        sendJson(res, 503, { error: "Could not read the stored state. Try again." });
        return;
      }

      const storedVersion = versionOf(stored);
      if (clientVersion !== storedVersion) {
        sendJson(res, 409, tutorConflictBody(clientVersion, storedVersion, stored, tutorKey));
        return;
      }

      const storedSnapshot = stored ? JSON.parse(JSON.stringify(stored)) : null;
      const baseState = JSON.parse(JSON.stringify(stored || existing || {}));
      mergePreservedPlanLocks(baseState, existing);
      mergeLearnerRecords(baseState, existing);
      const beforeTutor = JSON.parse(JSON.stringify(baseState));
      const merged = mergeTutorUpdates(baseState, updates, tutorKey);
      if (storedSnapshot && sameSavedContent(merged, beforeTutor)) {
        sendJson(res, 200, {
          state: filterStateForTutor(storedSnapshot, tutorKey),
          version: storedVersion,
          savedAt: storedSnapshot.savedAt || "",
          unchanged: true,
        });
        return;
      }
      merged.version = storedVersion + 1;
      merged.savedAt = new Date().toISOString();

      let committed;
      try {
        committed = await commitVersionedState(merged, clientVersion, {
          preserveLocks: false,
          actorId: user.id,
        });
      } catch (error) {
        if (error.status === 409) {
          let latest = stored;
          let latestVersion = storedVersion;
          try {
            const again = await readAppStatePayload();
            if (again.payload) {
              latest = again.payload;
              latestVersion = versionOf(again.payload);
            }
          } catch (readError) {
            logClientError("Failed to reread app_state after tutor conflict.", {
              status: readError?.status,
              code: readError?.code,
              route: "/api/tutor-state",
            });
          }
          sendJson(res, 409, tutorConflictBody(clientVersion, latestVersion, latest, tutorKey));
          return;
        }
        logClientError("Failed to save tutor updates.", {
          status: error?.status || 500,
          code: error?.code,
          route: "/api/tutor-state",
        });
        sendJson(res, error.status || 500, { error: "Failed to save." });
        return;
      }

      const filtered = filterStateForTutor(merged, tutorKey);
      const body = { state: filtered, version: merged.version, savedAt: merged.savedAt };
      if (committed?.warning) body.warning = true;
      sendJson(res, 200, body);
      return;
    }

    res.statusCode = 405;
    res.end();
  } catch (error) {
    logClientError("Tutor state request failed.", {
      status: error?.status || 500,
      code: error?.code,
      route: "/api/tutor-state",
    });
    if (!res.writableEnded) {
      const status = error.status || 500;
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: status === 401 || status === 403 || status === 400
            ? error.message
            : "An error occurred.",
        })
      );
    }
  }
}
