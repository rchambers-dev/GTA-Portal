import { apiFetch } from "../../app/persist.js";
import { clientMessage, logClientError, readResponseJson } from "../../safe-error.js";
import { improveTutorWording } from "../../tutor-ai.js";
import { updateTutorFieldLimit } from "./form-html.js";
import { setStatus } from "./validation.js";

export async function improveTutorField(button) {
  const field = button.closest(".tutor-field-box")?.querySelector("textarea");
  if (!field || field.readOnly) return;
  const text = field.value.trim();
  if (!text) {
    setStatus("Write something in this box first, then use AI to improve it.");
    return;
  }
  button.disabled = true;
  button.classList.add("is-busy");
  try {
    const response = await apiFetch("/api/tutor-reword", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        field: button.dataset.tutorAi || "evidence",
        wordLimit: Number(field.dataset.wordLimit || 0) || 0,
      }),
    });
    const data = await readResponseJson(response, "Tutor reword response was not JSON");
    if (!response.ok) logClientError("Tutor reword request failed", response.status);
    const next =
      response.ok && data?.text
        ? data.text
        : improveTutorWording(text, {
            field: button.dataset.tutorAi || "evidence",
            wordLimit: Number(field.dataset.wordLimit || 0) || 0,
          });
    if (!next) throw new Error(clientMessage(data?.error, "Could not improve this box."));
    field.value = next;
    updateTutorFieldLimit(field);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    setStatus("Wording updated. Check it still says what you meant.");
  } catch (error) {
    const next = improveTutorWording(text, {
      field: button.dataset.tutorAi || "evidence",
      wordLimit: Number(field.dataset.wordLimit || 0) || 0,
    });
    if (next && next !== text) {
      field.value = next;
      updateTutorFieldLimit(field);
      setStatus("Wording updated. Check it still says what you meant.");
    } else {
      logClientError("Could not improve the tutor field.");
      setStatus(clientMessage(error, "Could not improve this box."));
    }
  } finally {
    button.disabled = false;
    button.classList.remove("is-busy");
  }
}
