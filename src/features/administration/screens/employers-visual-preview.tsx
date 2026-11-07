"use client";

import { useReducer } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";
import {
  employerPreviewReducer,
  initialEmployerPreviewState,
  visibleEmployers,
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
              Company name is required. Phone and postcode belong to the company. Site and manager are optional and stay under the employer.
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
                <span>Site</span>
                <input
                  value={state.site}
                  placeholder="Optional"
                  onChange={(event) => dispatch({ type: "set-site", site: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>Manager</span>
                <input
                  value={state.manager}
                  placeholder="Optional"
                  onChange={(event) =>
                    dispatch({ type: "set-manager", manager: event.target.value })
                  }
                />
              </label>
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
              <li key={row.id} className={styles.pillRow}>
                <span className={styles.pillName}>{row.name}</span>
                <span className={styles.pillMeta}>
                  {[row.phone, row.postcode, row.site || "No site", row.manager || "No manager"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ApprenticePageShell>
  );
}
