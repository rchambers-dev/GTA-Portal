import { apiFetch } from "./persist.js";
import { clientMessage, logClientError, readResponseJson } from "../safe-error.js";
import { escapeHtml } from "../lib/html.js";
import { adminMode, signedInSession } from "./auth-ui.js";

let hooks = null;

export function bindFeedback(next) {
  hooks = next;
}

function appState() {
  return hooks?.getState?.() || {};
}

export function setFeedbackMessage(error = "", ok = "") {
  const errorEl = document.querySelector("#settings-feedback-error");
  const okEl = document.querySelector("#settings-feedback-ok");
  if (errorEl) {
    errorEl.hidden = !error;
    errorEl.textContent = error;
  }
  if (okEl) {
    okEl.hidden = !ok;
    okEl.textContent = ok;
  }
}

export function renderTutorFeedbackInbox() {
  const inbox = document.querySelector("#settings-feedback-inbox");
  const list = document.querySelector("#settings-feedback-list");
  const form = document.querySelector("#settings-feedback-form");
  const state = appState();
  if (!inbox || !list) return;
  const items = Array.isArray(state.tutorFeedback) ? state.tutorFeedback : [];
  const showInbox = adminMode && items.length;
  inbox.hidden = !showInbox;
  if (form) form.hidden = false;
  list.innerHTML = items
    .slice()
    .reverse()
    .map((item) => `
      <article class="settings-feedback-item">
        <p class="meta">${escapeHtml(item.email || "Tutor")} · ${escapeHtml(item.at ? String(item.at).slice(0, 10) : "")}</p>
        <p>${escapeHtml(item.message || "")}</p>
      </article>
    `)
    .join("");
}

export async function handleFeedbackSend(event) {
  event.preventDefault();
  setFeedbackMessage();
  const box = document.querySelector("#settings-feedback-text");
  const message = String(box?.value || "").trim();
  const submit = document.querySelector("#settings-feedback-send");
  if (!message) {
    setFeedbackMessage("Write a suggestion first.");
    return;
  }
  if (submit) submit.disabled = true;
  try {
    const response = await apiFetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        email: signedInSession?.user?.email || "",
      }),
    });
    const data = await readResponseJson(response, "Feedback response was not JSON");
    if (!response.ok || !data) {
      logClientError("Could not send feedback", response.status);
      throw new Error(clientMessage(data?.error, "Could not send that suggestion."));
    }
    const state = appState();
    if (Array.isArray(data.items)) state.tutorFeedback = data.items;
    if (box) box.value = "";
    setFeedbackMessage("", "Thanks — that has been sent.");
    renderTutorFeedbackInbox();
  } catch (error) {
    logClientError("Could not send feedback.");
    setFeedbackMessage(clientMessage(error, "Could not send that suggestion."));
  } finally {
    if (submit) submit.disabled = false;
  }
}

export async function loadFeedbackInbox() {
  const state = appState();
  try {
    const response = await apiFetch("/api/feedback");
    const data = await response.json();
    if (Array.isArray(data.items)) state.tutorFeedback = data.items;
  } catch {
    state.tutorFeedback = Array.isArray(state.tutorFeedback) ? state.tutorFeedback : [];
  }
}
