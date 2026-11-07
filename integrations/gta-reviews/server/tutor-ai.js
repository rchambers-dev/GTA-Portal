import { loadEnv } from "./env.js";
import { improveTutorWording, tutorAiSystemPrompt } from "../src/tutor-ai.js";

const PREFERRED_MODELS = ["gpt-6.1-sol", "gpt-6-astra"];

function openaiKey() {
  loadEnv();
  return (
    process.env.OPENAI_API_KEY ||
    process.env.NODE_OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    ""
  );
}

function modelList() {
  loadEnv();
  const preferred = String(process.env.OPENAI_MODEL || PREFERRED_MODELS[0]).trim();
  return [...new Set([preferred, ...PREFERRED_MODELS])];
}

function isMissingModelError(data) {
  const text = JSON.stringify(data || {}).toLowerCase();
  return (
    text.includes("model") &&
    (text.includes("does not exist") ||
      text.includes("not found") ||
      text.includes("invalid") ||
      text.includes("not available") ||
      text.includes("access"))
  );
}

async function rewriteWithModel(key, model, text, field, wordLimit) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: tutorAiSystemPrompt(field, wordLimit) },
        { role: "user", content: text },
      ],
    }),
  });
  const data = await response.json();
  return { response, data };
}

async function rewriteWithOpenAi(text, field, wordLimit) {
  const key = openaiKey();
  if (!key) return "";
  let lastError = "";
  for (const model of modelList()) {
    const { response, data } = await rewriteWithModel(key, model, text, field, wordLimit);
    if (response.ok) {
      return String(data?.choices?.[0]?.message?.content || "").trim();
    }
    lastError = data?.error?.message || "The AI service could not rewrite this.";
    if (!isMissingModelError(data)) throw new Error(lastError);
  }
  throw new Error(lastError);
}

export async function rewordTutorText({ text, field, wordLimit } = {}) {
  const source = String(text || "").trim();
  if (!source) {
    const error = new Error("Write something in this box first.");
    error.status = 400;
    throw error;
  }
  const kind = String(field || "evidence");
  const limit = Number(wordLimit || 0) || 0;
  const ai = await rewriteWithOpenAi(source, kind, limit);
  if (!ai) {
    const error = new Error("AI wording is not configured on this server.");
    error.status = 500;
    throw error;
  }
  return improveTutorWording(ai, { field: kind, wordLimit: limit });
}
