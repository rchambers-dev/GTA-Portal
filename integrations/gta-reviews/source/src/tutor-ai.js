const FIELD_HINTS = {
  summary: "Write a short tutor summary of last time from the previous tutor notes.",
  action: "Write a clear action the apprentice, employer or tutor should complete.",
  measure: "Write how success will be judged and what support is needed.",
  evidence: "Write evidence of progress from the work the tutor has seen, the workbook, or their own notes.",
  comment: "Write the GTA tutor contribution in the tutor's voice, from the work they have seen.",
};

function tidyTutorText(value) {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = text
    .replace(/\bappr\b/gi, "apprentice")
    .replace(/\bwkbk\b/gi, "workbook")
    .replace(/\botj\b/gi, "off-the-job")
    .replace(/\bepa\b/gi, "EPA");
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const ended = /[.!?]$/.test(part) ? part : `${part}.`;
      return ended.charAt(0).toUpperCase() + ended.slice(1);
    });
  return parts.join(" ");
}

function clipWords(value, wordLimit) {
  const text = String(value || "").trim();
  if (!wordLimit) return text;
  const words = text.split(/\s+/);
  if (words.length <= wordLimit) return text;
  return words.slice(0, wordLimit).join(" ");
}

export function improveTutorWording(value, { field = "evidence", wordLimit = 0 } = {}) {
  const cleaned = tidyTutorText(value);
  if (!cleaned) return "";
  return clipWords(cleaned, wordLimit);
}

export function tutorAiSystemPrompt(field, wordLimit) {
  const hint = FIELD_HINTS[field] || FIELD_HINTS.evidence;
  const limit = wordLimit ? ` Use at most ${wordLimit} words.` : "";
  return `You improve wording for a UK GTA apprenticeship tripartite progress review. ${hint} Write as the GTA tutor. Keep the same facts. Do not invent evidence, names, dates or outcomes. Do not invent a conversation with the employer, workplace mentor, apprentice, or another tutor unless the source text already says that conversation happened. Use clear professional UK English. Return only the rewritten text.${limit}`;
}
