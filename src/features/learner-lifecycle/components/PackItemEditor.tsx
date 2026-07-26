"use client";

import { useEffect, useMemo, useState } from "react";
import type { EvidenceRequirementRowDto } from "../types";
import {
  derivePackItemStatus,
  emptyPackItem,
  kindLabel,
  schemaForReference,
  type PackItemRecord,
} from "../domain/pack-item-model";
import { getPackItem, upsertPackItem } from "../domain/pack-store";
import { evidenceStatusLabel, evidenceStatusTone } from "../lib/status";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDemoSession } from "@/shell/demo/DemoSessionProvider";
import styles from "./PackItemEditor.module.css";

type Props = {
  learnerId: string;
  row: EvidenceRequirementRowDto;
  onClose: () => void;
  onSaved: () => void;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function recordFromRow(
  learnerId: string,
  row: EvidenceRequirementRowDto,
): PackItemRecord {
  const stored = getPackItem(learnerId, row.reference);
  if (stored) {
    return {
      ...stored,
      notApplicable:
        stored.notApplicable ?? stored.status === "not_applicable",
    };
  }
  const blank = emptyPackItem(
    row.reference,
    row.status === "future_requirement",
  );
  return {
    ...blank,
    status: row.status,
    notes: row.notes ?? "",
    dateReceived: row.dateReceived ?? "",
    checkedBy: row.checkedBy ?? "",
    dateChecked: row.dateChecked ?? "",
    notApplicable: row.status === "not_applicable",
  };
}

export function PackItemEditor({ learnerId, row, onClose, onSaved }: Props) {
  const { session } = useDemoSession();
  const editorName = session.account.name;
  const schema = schemaForReference(row.reference);
  const endOfProgramme = row.status === "future_requirement" ||
    row.originalBookletSection === "Section 6";
  const [draft, setDraft] = useState<PackItemRecord>(() =>
    recordFromRow(learnerId, row),
  );
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(recordFromRow(learnerId, row));
  }, [learnerId, row]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const derivedStatus = useMemo(
    () =>
      derivePackItemStatus({
        endOfProgramme,
        kind: schema.kind,
        fields: schema.fields,
        values: draft.fields,
        evidenceLabel: draft.evidenceLabel,
        dateReceived: draft.dateReceived,
        notes: draft.notes,
        notApplicable: draft.notApplicable,
      }),
    [
      draft.dateReceived,
      draft.evidenceLabel,
      draft.fields,
      draft.notApplicable,
      draft.notes,
      endOfProgramme,
      schema.fields,
      schema.kind,
    ],
  );

  function setField(key: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: value },
    }));
  }

  function save() {
    const next: PackItemRecord = {
      ...draft,
      checkedBy: editorName,
      dateChecked: todayIsoDate(),
      status: derivedStatus,
    };

    upsertPackItem(learnerId, row.reference, next);
    setDraft(next);
    setSavedFlash(true);
    onSaved();
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  const fieldsDisabled = draft.notApplicable;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-item-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <div>
            <p className={styles.eyebrow}>
              {row.originalBookletSection} · {row.reference} ·{" "}
              {kindLabel(schema.kind)}
            </p>
            <h2 id="pack-item-editor-title" className={styles.title}>
              {row.title}
            </h2>
            <p className={styles.meta}>{row.applicability}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            Close
          </button>
        </header>

        {endOfProgramme ? (
          <p className={styles.banner}>
            End-of-programme item — stays Future until you start entering data
            (or until gateway / EPA).
          </p>
        ) : null}

        <div className={styles.body}>
          <div className={styles.statusDerived}>
            <span className={styles.statusDerivedLabel}>Status</span>
            <StatusBadge tone={evidenceStatusTone(derivedStatus)} size="md">
              {evidenceStatusLabel(derivedStatus)}
            </StatusBadge>
            <p className={styles.statusDerivedHint}>
              Derived from what you enter — Missing until data is in, Received
              once started, Checked when the form is complete
              {row.requirementKind === "conditional"
                ? ", or Not applicable if it does not apply"
                : ""}
              .
            </p>
          </div>

          {row.requirementKind === "conditional" ? (
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={draft.notApplicable}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    notApplicable: e.target.checked,
                  }))
                }
              />
              <span>Does not apply for this learner</span>
            </label>
          ) : null}

          {schema.fields.map((field) => (
            <label key={field.key} className={styles.field}>
              <span>{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={draft.fields[field.key] ?? ""}
                  placeholder={field.placeholder}
                  disabled={fieldsDisabled}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : field.type}
                  value={draft.fields[field.key] ?? ""}
                  placeholder={field.placeholder}
                  disabled={fieldsDisabled}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
              )}
            </label>
          ))}

          {(schema.kind === "document" || schema.kind === "hybrid") && (
            <label className={styles.field}>
              <span>Evidence file / link (placeholder until upload)</span>
              <input
                type="text"
                value={draft.evidenceLabel}
                placeholder="e.g. training-plan-v1.pdf or SharePoint link"
                disabled={fieldsDisabled}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    evidenceLabel: e.target.value,
                  }))
                }
              />
            </label>
          )}

          <label className={styles.field}>
            <span>Date received</span>
            <input
              type="date"
              value={draft.dateReceived}
              disabled={fieldsDisabled}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  dateReceived: e.target.value,
                }))
              }
            />
          </label>

          <div className={styles.auditBlock}>
            <p className={styles.auditLabel}>Last edited by</p>
            <p className={styles.auditValue}>
              {draft.checkedBy && draft.dateChecked
                ? `${draft.checkedBy} · ${new Date(`${draft.dateChecked}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                : `Will stamp as ${editorName} when you save`}
            </p>
            <p className={styles.auditHint}>
              Auto-filled from the signed-in user on every save — so you can
              see who changed what.
            </p>
          </div>

          <label className={styles.field}>
            <span>Notes</span>
            <textarea
              rows={3}
              value={draft.notes}
              disabled={fieldsDisabled}
              placeholder={
                endOfProgramme
                  ? "Optional notes while this stays a future requirement…"
                  : "Anything staff should know…"
              }
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </label>
        </div>

        <footer className={styles.foot}>
          {savedFlash ? (
            <span className={styles.saved}>
              Saved as {evidenceStatusLabel(derivedStatus)} — stamped as{" "}
              {editorName}
            </span>
          ) : (
            <span className={styles.hint}>
              Status updates from your inputs. Save stamps {editorName}.
            </span>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={styles.primary} onClick={save}>
              Save item
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
