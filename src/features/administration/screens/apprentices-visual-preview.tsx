"use client";

import { useReducer } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";
import {
  apprenticePreviewReducer,
  employerName,
  initialApprenticePreviewState,
  visibleApprentices,
  type ApprenticePreviewState,
} from "./visual-preview-state";

/**
 * Layout preview on the existing Apprentices routes.
 * Search, the add container, and the employer selector change local state only.
 */
export function ApprenticesVisualPreview({
  initialState,
}: {
  initialState?: ApprenticePreviewState;
} = {}) {
  const [state, dispatch] = useReducer(
    apprenticePreviewReducer,
    initialState,
    (seed) => seed ?? initialApprenticePreviewState(),
  );
  const rows = visibleApprentices(state);

  return (
    <ApprenticePageShell
      eyebrow="Apprentices"
      title="Apprentices"
      description="Search the list, or open Add apprentice. Example data only. Saving is disabled."
      actions={
        <button
          type="button"
          className={styles.primaryBtn}
          aria-expanded={state.addOpen}
          onClick={() => dispatch({ type: "toggle-add" })}
        >
          {state.addOpen ? "Close" : "Add apprentice"}
        </button>
      }
    >
      <div className={styles.stack} data-visual="apprentices">
        <p className={styles.previewBanner} role="status">
          EXAMPLE DATA. Saving is disabled. Phone and postcode belong on the employer, not here.
        </p>

        <div className={styles.registryToolbar}>
          <label className={styles.registrySearch}>
            <span className={styles.registrySearchLabel}>Search apprentices</span>
            <input
              type="search"
              value={state.query}
              placeholder="Search by apprentice or employer"
              onChange={(event) => dispatch({ type: "search", query: event.target.value })}
            />
          </label>
        </div>

        {state.addOpen ? (
          <form
            className={styles.addPanel}
            data-add-panel="apprentice"
            onSubmit={(event) => {
              event.preventDefault();
              dispatch({ type: "add-local" });
            }}
          >
            <h2 className={styles.formGroupTitle}>Add apprentice</h2>
            <p className={styles.formGroupMeta}>
              Full name is the apprentice field. Choose an employer if one should be linked. Nothing is written to the portal.
            </p>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>
                  Full name <em className={styles.fieldRequired}>required</em>
                </span>
                <input
                  value={state.fullName}
                  onChange={(event) =>
                    dispatch({ type: "set-name", fullName: event.target.value })
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Employer</span>
                <select
                  value={state.employerId}
                  onChange={(event) =>
                    dispatch({ type: "set-employer", employerId: event.target.value })
                  }
                >
                  <option value="">Not linked</option>
                  {state.employers.map((employer) => (
                    <option key={employer.id} value={employer.id}>
                      {employer.name}
                    </option>
                  ))}
                </select>
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
                Add apprentice
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
            No apprentices match this search.
          </p>
        ) : (
          <ul className={styles.pillList}>
            {rows.map((row) => (
              <li key={row.id} className={styles.pillRow}>
                <span className={styles.pillName}>{row.fullName}</span>
                <span className={styles.pillMeta}>
                  {employerName(row.employerId, state.employers)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ApprenticePageShell>
  );
}
