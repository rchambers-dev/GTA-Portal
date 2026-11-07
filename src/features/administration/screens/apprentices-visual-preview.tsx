"use client";

import { useReducer } from "react";
import { Select } from "@/components/ui";
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
          <section className={styles.learnerAdd} data-add-panel="apprentice">
            <p className={styles.learnerKicker}>Manual entry</p>
            <h2 className={styles.learnerHeading}>Add apprentice</h2>
            <p className={styles.learnerMuted}>
              Full name is the only required detail. Leave anything unknown blank. No account or enrolment is created. Saving is disabled.
            </p>
            <article className={styles.learnerCard}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  dispatch({ type: "add-local" });
                }}
              >
                <div className={styles.learnerGrid}>
                  <label className={styles.learnerField}>
                    <span>
                      Full name <em className={styles.fieldRequired}>required</em>
                    </span>
                    <input
                      value={state.fullName}
                      required
                      onChange={(event) =>
                        dispatch({ type: "set-name", fullName: event.target.value })
                      }
                    />
                  </label>
                  <div className={styles.learnerField}>
                    <span>Employer</span>
                    <Select
                      aria-label="Employer"
                      value={state.employerId}
                      options={[
                        { value: "", label: "Not linked" },
                        ...state.employers.map((employer) => ({
                          value: employer.id,
                          label: employer.name,
                        })),
                      ]}
                      onChange={(employerId) => dispatch({ type: "set-employer", employerId })}
                    />
                  </div>
                </div>
                <label className={styles.learnerField}>
                  <span>Notes</span>
                  <textarea
                    value={state.notes}
                    onChange={(event) => dispatch({ type: "set-notes", notes: event.target.value })}
                  />
                </label>
                {state.notice ? <p className={styles.learnerMuted}>{state.notice}</p> : null}
                <div className={styles.learnerActions}>
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
            </article>
          </section>
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
              <li key={row.id} className={`${styles.pillRow} ${styles.employerRow}`}>
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
