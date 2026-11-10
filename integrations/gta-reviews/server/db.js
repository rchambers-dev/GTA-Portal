import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { mergePreservedPlanLocks } from "../src/plan-locks.js";
import { onVercel } from "./runtime.js";
import { logClientError } from "../shared/log-error.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.REVIEW_DATA_DIR
  ? path.resolve(process.env.REVIEW_DATA_DIR)
  : path.join(root, "data");

let dbPath = null;
let db = null;
// Kept so a read-only filesystem does not crash startup. Not read yet.
let dbInitError = null;

// Serverless instances have no durable local database. Do not create the file.
if (!onVercel()) try {
  fs.mkdirSync(dataDir, { recursive: true });
  dbPath = path.join(dataDir, "review-assistant.sqlite");
  db = new DatabaseSync(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      postcode TEXT NOT NULL,
      college_day TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      date_key TEXT NOT NULL,
      position INTEGER NOT NULL,
      learner_id TEXT NOT NULL,
      PRIMARY KEY (date_key, position)
    );

    CREATE TABLE IF NOT EXISTS verified (
      date_key TEXT NOT NULL,
      learner_id TEXT NOT NULL,
      PRIMARY KEY (date_key, learner_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
} catch (error) {
  // eslint-disable-next-line no-unused-vars
  dbInitError = error;
  // In serverless environments (Vercel), filesystem may be read-only
  // Store error but don't crash - functions will gracefully return null
  logClientError("Database initialization failed.", { code: error?.code });
}

export { dbPath };

function replaceTable(name, rows, insertSql, mapRow) {
  db.exec(`DELETE FROM ${name}`);
  const insert = db.prepare(insertSql);
  for (const row of rows) insert.run(...mapRow(row));
}

export function loadPayload() {
  if (!db) return null;
  try {
    const row = db.prepare("SELECT value FROM kv WHERE key = ?").get("state");
    return row ? JSON.parse(row.value) : null;
  } catch (error) {
    logClientError("loadPayload failed.", { code: error?.code });
    return null;
  }
}

export function savePayload(state, { preserveLocks = true } = {}) {
  if (!db) {
    console.warn("savePayload: database not available");
    return;
  }
  if (preserveLocks) mergePreservedPlanLocks(state, loadPayload());
  const payload = JSON.stringify(state);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO kv (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run("state", payload);

    replaceTable(
      "learners",
      state.learners || [],
      "INSERT INTO learners (id, name, postcode, college_day) VALUES (?, ?, ?, ?)",
      (learner) => [learner.id, learner.name, learner.postcode, learner.collegeDay],
    );

    const stops = [];
    for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
      ids.forEach((learnerId, position) => {
        stops.push({ dateKey, position, learnerId });
      });
    }
    replaceTable(
      "route_stops",
      stops,
      "INSERT INTO route_stops (date_key, position, learner_id) VALUES (?, ?, ?)",
      (stop) => [stop.dateKey, stop.position, stop.learnerId],
    );

    const verified = [];
    for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
      for (const learnerId of ids) verified.push({ dateKey, learnerId });
    }
    replaceTable(
      "verified",
      verified,
      "INSERT INTO verified (date_key, learner_id) VALUES (?, ?)",
      (row) => [row.dateKey, row.learnerId],
    );

    replaceTable(
      "settings",
      Object.entries(state.settings || {}),
      "INSERT INTO settings (key, value) VALUES (?, ?)",
      ([key, value]) => [key, JSON.stringify(value)],
    );
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch (rollbackError) {
      logClientError("SQLite rollback failed.", { code: rollbackError?.code });
    }
    logClientError("savePayload failed.", { code: error?.code });
    throw error;
  }
}

export { db };
