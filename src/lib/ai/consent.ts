/**
 * Portal-wide AI consent — persisted locally so apprentices only agree once,
 * and can withdraw at any time (which requires agreeing again to re-enable).
 */

export const AI_CONSENT_STORAGE_KEY = "gta.ai.consent.v1";
/** Bump if the legal wording changes enough that users should re-consent. */
export const AI_CONSENT_VERSION = 1;

export type AiConsentRecord = {
  version: number;
  /** true = agreed, false = declined / turned off, null = never decided */
  agreed: boolean | null;
  decidedAt: string | null;
};

export const AI_CONSENT_TITLE = "Before you use AI in the GTA portal";

export const AI_CONSENT_POINTS = [
  "Parts of this portal use artificial intelligence (AI) to help you — for example improving CV wording.",
  "Your personal information is not used to train AI models, and GTA does not keep a lasting copy of what you send to AI for those features.",
  "Content sent to AI is used only to produce your request in that moment. Once that request is finished, it is not remembered by the AI service for future chats or profiles.",
  "When you download or email your CV to yourself, that copy is yours. It is separate from the short-lived AI request and is not stored by the AI model.",
  "You can turn AI off at any time. If you do, you will need to agree again before using AI features.",
] as const;

export const AI_CONSENT_SUMMARY =
  "AI is used only to help with your request. Your personal details are not stored or remembered by the AI model after the request ends, and are not used to train models.";

export function defaultAiConsent(): AiConsentRecord {
  return {
    version: AI_CONSENT_VERSION,
    agreed: null,
    decidedAt: null,
  };
}

export function readAiConsent(): AiConsentRecord {
  if (typeof window === "undefined") return defaultAiConsent();
  try {
    const raw = window.localStorage.getItem(AI_CONSENT_STORAGE_KEY);
    if (!raw) return defaultAiConsent();
    const parsed = JSON.parse(raw) as Partial<AiConsentRecord>;
    if (parsed.version !== AI_CONSENT_VERSION) {
      // Wording changed — ask again.
      return defaultAiConsent();
    }
    return {
      version: AI_CONSENT_VERSION,
      agreed: typeof parsed.agreed === "boolean" ? parsed.agreed : null,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : null,
    };
  } catch {
    return defaultAiConsent();
  }
}

export function writeAiConsent(agreed: boolean): AiConsentRecord {
  const record: AiConsentRecord = {
    version: AI_CONSENT_VERSION,
    agreed,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(AI_CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable — still return in-memory decision for this session.
  }
  return record;
}

export function clearAiConsent(): AiConsentRecord {
  const record = defaultAiConsent();
  try {
    window.localStorage.removeItem(AI_CONSENT_STORAGE_KEY);
  } catch {
    // ignore
  }
  return record;
}

export function formatConsentDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
