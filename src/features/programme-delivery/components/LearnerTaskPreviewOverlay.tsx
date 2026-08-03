"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  modulesToSections,
  type AuthoredTaskForm,
} from "@/features/programme-delivery/domain/form-modules";
import {
  isApprenticeEditableField,
  TaskFieldInput,
} from "@/features/programme-delivery/components/TaskFieldInput";
import fillStyles from "@/features/programme-delivery/screens/programme-delivery.module.css";
import styles from "./LearnerTaskPreviewOverlay.module.css";

type Props = {
  form: AuthoredTaskForm;
  /** Optional extras from the block task draft. */
  objectives?: string[];
  instructions?: string[];
  estimatedMinutes?: number;
  onClose: () => void;
};

/**
 * Full-screen apprentice portal preview — same layout/fields as the live task
 * page. Isolated so Course Builder content underneath cannot be scrolled into.
 */
export function LearnerTaskPreviewOverlay({
  form,
  objectives = [],
  instructions = [],
  estimatedMinutes = 60,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const sections = useMemo(
    () => modulesToSections(form.modules),
    [form.modules],
  );

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Learner preview">
      <div className={styles.chrome}>
        <p className={styles.chromeLabel}>
          Apprentice preview — exact learner view of this form. Answers are not
          saved. Esc or Back to editor when finished.
        </p>
        <button type="button" className={styles.backBtn} onClick={onClose}>
          ← Back to editor
        </button>
      </div>

      <div className={styles.scroll}>
        <div className={styles.portalFrame}>
          <ApprenticePageShell
            title={form.title.trim() || "Untitled task"}
            actions={
              <>
                <ApprenticeStatusChip tone="neutral" size="lg">
                  ~{estimatedMinutes} min
                </ApprenticeStatusChip>
                <ApprenticeStatusChip tone="amber" size="lg">
                  Not started
                </ApprenticeStatusChip>
              </>
            }
          >
            <div className={fillStyles.root}>
              <span className={fillStyles.back}>← Back to college tasks</span>

              <div className={fillStyles.purpose}>
                <p className={fillStyles.purposeLabel}>Scenario</p>
                <p className={fillStyles.purposeBody}>
                  {form.scenario.trim() || "No scenario written yet."}
                </p>
                {objectives.length > 0 ? (
                  <>
                    <p className={fillStyles.purposeLabel}>What you need to do</p>
                    <ul className={fillStyles.objectives}>
                      {objectives.map((o) => (
                        <li key={o}>{o}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {instructions.length > 0 ? (
                  <>
                    <p className={fillStyles.purposeLabel}>
                      Practical task instructions
                    </p>
                    <ol className={fillStyles.objectives}>
                      {instructions.map((step, i) => (
                        <li key={`${i}-${step}`}>{step}</li>
                      ))}
                    </ol>
                  </>
                ) : null}
                <p className={fillStyles.purposeNote}>
                  Preferred: portal form. Upload PDFs only if you could not get
                  on that day — upload every PDF needed for this task.
                </p>
              </div>

              <div className={fillStyles.methodBar}>
                <span className={fillStyles.fieldHint}>Submission method:</span>
                <button type="button" className={fillStyles.methodActive}>
                  Portal form
                </button>
                <button type="button" className={fillStyles.methodFallback} disabled>
                  PDF upload (fallback)
                </button>
              </div>

              {form.modules.length === 0 ? (
                <section className={fillStyles.sectionCard}>
                  <p className={fillStyles.fieldHint}>
                    No form modules yet — go back to the editor and add some.
                  </p>
                </section>
              ) : (
                <div className={fillStyles.formStack}>
                  {sections.map((section) => (
                    <section key={section.id} className={fillStyles.sectionCard}>
                      <h2 className={fillStyles.sectionTitle}>{section.title}</h2>
                      {section.fields.map((field) => (
                        <TaskFieldInput
                          key={field.key}
                          field={field}
                          value={fields[field.key] ?? ""}
                          staffLocked={!isApprenticeEditableField(field)}
                          onChange={(next) => {
                            if (!isApprenticeEditableField(field)) return;
                            setFields((prev) => ({
                              ...prev,
                              [field.key]: next,
                            }));
                          }}
                        />
                      ))}
                    </section>
                  ))}
                </div>
              )}

              <div className={fillStyles.autosaveBar} data-state="saved">
                <p className={fillStyles.autosaveText}>
                  Preview only — answers are not saved
                </p>
                <button type="button" className={fillStyles.primaryBtn} disabled>
                  Submit for sign-off
                </button>
              </div>
            </div>
          </ApprenticePageShell>
        </div>
      </div>
    </div>,
    document.body,
  );
}
