"use client";

import { useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";
import {
  confirmationKey,
  employerMeta,
  employerPreviewReducer,
  initialEmployerPreviewState,
  nextModalFocus,
  visibleEmployers,
  type DraftEntry,
  type EmployerPreviewAction,
  type EmployerPreviewState,
} from "./visual-preview-state";

/**
 * Layout preview on the existing employer-record routes.
 * Company phone and postcode stay on this page. Site and manager are optional.
 */
export function EmployersVisualPreview({
  initialState,
}: {
  initialState?: EmployerPreviewState;
} = {}) {
  const [state, dispatch] = useReducer(
    employerPreviewReducer,
    initialState,
    (seed) => seed ?? initialEmployerPreviewState(),
  );
  const rows = visibleEmployers(state);

  return (
    <>
    <ApprenticePageShell
      eyebrow="Employers"
      title="Employers"
      description="Search companies, or open Add employer. Example data only. Saving is disabled."
      actions={
        <button
          type="button"
          className={styles.primaryBtn}
          aria-expanded={state.addOpen}
          onClick={() => dispatch({ type: "toggle-add" })}
        >
          {state.addOpen ? "Close" : "Add employer"}
        </button>
      }
    >
      <div className={styles.stack} data-visual="employers">
        <p className={styles.previewBanner} role="status">
          EXAMPLE DATA. Saving is disabled. Phone number and postcode are company details.
        </p>

        <div className={styles.registryToolbar}>
          <label className={styles.registrySearch}>
            <span className={styles.registrySearchLabel}>Search employers</span>
            <input
              type="search"
              value={state.query}
              placeholder="Search by company, phone, postcode, site, or manager"
              onChange={(event) => dispatch({ type: "search", query: event.target.value })}
            />
          </label>
        </div>

        {state.addOpen ? (
          <form
            className={styles.addPanel}
            data-add-panel="employer"
            onSubmit={(event) => {
              event.preventDefault();
              dispatch({ type: "add-local" });
            }}
          >
            <h2 className={styles.formGroupTitle}>Add employer</h2>
            <p className={styles.formGroupMeta}>
              Company name is required. Phone number and postcode belong to the company. Contact name, email, and phone are separate from the manager. Site and manager are optional.
            </p>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>
                  Company name <em className={styles.fieldRequired}>required</em>
                </span>
                <input
                  value={state.name}
                  onChange={(event) => dispatch({ type: "set-name", name: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>Phone number</span>
                <input
                  value={state.phone}
                  inputMode="tel"
                  onChange={(event) => dispatch({ type: "set-phone", phone: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>Postcode</span>
                <input
                  value={state.postcode}
                  onChange={(event) =>
                    dispatch({ type: "set-postcode", postcode: event.target.value })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Employer contact name</span>
                <input
                  value={state.contactName}
                  onChange={(event) =>
                    dispatch({ type: "set-contact-name", contactName: event.target.value })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Employer contact email</span>
                <input
                  type="email"
                  value={state.contactEmail}
                  onChange={(event) =>
                    dispatch({ type: "set-contact-email", contactEmail: event.target.value })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Employer contact phone</span>
                <input
                  type="tel"
                  value={state.contactPhone}
                  onChange={(event) =>
                    dispatch({ type: "set-contact-phone", contactPhone: event.target.value })
                  }
                />
              </label>
              <RepeatableEntries kind="site" entries={state.sites} dispatch={dispatch} />
              <RepeatableEntries kind="manager" entries={state.managers} dispatch={dispatch} />
            </div>
            {state.notice ? <p className={styles.formGroupMeta}>{state.notice}</p> : null}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => dispatch({ type: "cancel-add" })}
              >
                Cancel
              </button>
              <button type="submit" className={styles.primaryBtn}>
                Add employer
              </button>
            </div>
          </form>
        ) : null}

        {!state.addOpen && state.notice ? (
          <p className={styles.formGroupMeta} role="status">
            {state.notice}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className={styles.empty} role="status">
            No employers match this search.
          </p>
        ) : (
          <ul className={styles.pillList}>
            {rows.map((row) => (
              <li key={row.id} className={`${styles.pillRow} ${styles.employerRow}`}>
                <span className={styles.pillName}>{row.name}</span>
                <span className={styles.pillMeta}>{employerMeta(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ApprenticePageShell>
    {state.pendingRemove ? (
      <RemoveEntryModal
        kind={state.pendingRemove.kind}
        dispatch={dispatch}
      />
    ) : null}
    </>
  );
}

function RepeatableEntries({
  kind,
  entries,
  dispatch,
}: {
  kind: "site" | "manager";
  entries: DraftEntry[];
  dispatch: (action: EmployerPreviewAction) => void;
}) {
  const noun = kind === "site" ? "Site" : "Manager";
  const addLabel = kind === "site" ? "Add site" : "Add manager";
  return (
    <div className={styles.entryGroup}>
      <div className={styles.entryHeading} data-entry-heading={kind}>
        <span className={styles.entryHeadingText}>{noun}</span>
        <button
          type="button"
          className={styles.entryAdd}
          data-entry-add={kind}
          aria-label={addLabel}
          onClick={() => dispatch(kind === "site" ? { type: "add-site" } : { type: "add-manager" })}
        >
          {addLabel}
        </button>
      </div>
      {entries.map((entry, index) => {
        const number = index + 1;
        const fieldLabel = `${noun} ${number}`;
        return (
          <div key={entry.id} className={styles.entryRow} data-entry-row={kind}>
            <label className={styles.field}>
              {number > 1 ? <span>{fieldLabel}</span> : null}
              <input
                value={entry.label}
                placeholder="Optional"
                aria-label={fieldLabel}
                onChange={(event) =>
                  dispatch(
                    kind === "site"
                      ? { type: "set-site", id: entry.id, label: event.target.value }
                      : { type: "set-manager", id: entry.id, label: event.target.value },
                  )
                }
              />
            </label>
            {index > 0 ? (
              <button
                type="button"
                className={styles.entryRemove}
                aria-label={`Remove ${noun.toLowerCase()} ${number}`}
                onClick={() => dispatch({ type: "request-remove", kind, id: entry.id })}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RemoveEntryModal({
  kind,
  dispatch,
}: {
  kind: "site" | "manager";
  dispatch: (action: EmployerPreviewAction) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const buttons = () => [...(dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    buttons()[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (confirmationKey(event.key) === "cancel") {
        event.preventDefault();
        dispatch({ type: "cancel-remove" });
        return;
      }
      if (event.key !== "Tab") return;
      const items = buttons();
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = nextModalFocus(index, items.length, event.shiftKey);
      event.preventDefault();
      items[next]?.focus();
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [dispatch]);

  const modal = (
    <div className={styles.modalBackdrop} data-modal-backdrop="entry-remove">
      <div
        ref={dialogRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-remove-title"
        aria-describedby="entry-remove-copy"
        data-modal="entry-remove"
        tabIndex={-1}
      >
        <h3 id="entry-remove-title" className={styles.confirmTitle}>
          Are you sure?
        </h3>
        <p id="entry-remove-copy" className={styles.formGroupMeta}>
          Remove this {kind} from the preview. Nothing is deleted from the portal.
        </p>
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            data-confirm-cancel
            onClick={() => dispatch({ type: "cancel-remove" })}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => dispatch({ type: "confirm-remove" })}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
