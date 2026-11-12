import { randomUUID } from "node:crypto";
import { getReviewRepository } from "./repository";
import type { ReviewState } from "./state-store";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function listTutorFeedback(state: ReviewState) {
  return (Array.isArray(state.tutorFeedback) ? state.tutorFeedback : [])
    .map((value) => {
      const message = String(value?.message || "").trim();
      if (!message) return null;
      return {
        id: String(value.id || ""),
        email: String(value.email || "").trim(),
        message: message.slice(0, 2000),
        at: String(value.at || ""),
      };
    })
    .filter((item): item is { id: string; email: string; message: string; at: string } => Boolean(item));
}

export async function addTutorFeedback(input: { email?: string; message?: unknown; actorId?: string }) {
  if (typeof input.message !== "string") {
    const error = new Error("Message must be a string.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  const message = input.message.trim();
  if (message.length < 3) {
    const error = new Error("Message must be at least 3 characters.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  if (message.length > 2000) {
    const error = new Error("Message must not exceed 2000 characters.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  const email = String(input.email || "").trim();
  if (email && (email.length > 500 || !EMAIL.test(email))) {
    const error = new Error("Invalid email format.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  const item = { id: randomUUID(), email, message, at: new Date().toISOString() };
  const repo = getReviewRepository();
  const state = await repo.readDocument();
  const items = [...listTutorFeedback(state), item];
  const saved = await repo.saveDocument({ ...state, tutorFeedback: items }, state.version || 1, input.actorId || "");
  if (saved.status === 409) {
    const error = new Error("Data was modified elsewhere. Please reload and try again.");
    (error as Error & { status: number }).status = 409;
    throw error;
  }
  return items;
}
