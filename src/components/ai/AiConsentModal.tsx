"use client";

import { AI_CONSENT_POINTS, AI_CONSENT_TITLE } from "@/lib/ai/consent";
import styles from "./AiConsentModal.module.css";

export function AiConsentModal({
  open,
  onAgree,
  onDecline,
}: {
  open: boolean;
  onAgree: () => void;
  onDecline: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDecline();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-consent-title"
      >
        <p className={styles.eyebrow}>GTA Apprenticeship</p>
        <h2 id="ai-consent-title" className={styles.title}>
          {AI_CONSENT_TITLE}
        </h2>
        <ul className={styles.list}>
          {AI_CONSENT_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className={styles.note}>
          By selecting Agree, you confirm you understand how AI is used here and
          choose to enable AI features.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.decline} onClick={onDecline}>
            Decline
          </button>
          <button type="button" className={styles.agree} onClick={onAgree}>
            Agree
          </button>
        </div>
      </div>
    </div>
  );
}
