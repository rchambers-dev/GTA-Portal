"use client";

import { useReducer } from "react";
import { Select } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";
import {
  APPRENTICESHIPS,
  EMPLOYER_STATUSES,
  ENQUIRY_SOURCES,
  PREVIEW_STAFF_OPTIONS,
  RELEASE_DAYS,
  RESPONSIVENESS_OPTIONS,
  TRAINING_SITES,
} from "./learner-entry-options";
import {
  apprenticePreviewReducer,
  employerName,
  initialApprenticePreviewState,
  visibleApprentices,
  type ApprenticeEntryFields,
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
              First name and last name are required. Leave anything unknown blank. No account or enrolment is created. Saving is disabled.
            </p>
            <article className={styles.learnerCard}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  dispatch({ type: "add-local" });
                }}
              >
                <div className={styles.learnerGrid}>
                  <TextEntry
                    field="firstName"
                    label="First name"
                    required
                    value={state.firstName}
                    dispatch={dispatch}
                  />
                  <TextEntry
                    field="lastName"
                    label="Last name"
                    required
                    value={state.lastName}
                    dispatch={dispatch}
                  />
                  <TextEntry
                    field="externalLearnerId"
                    label="Existing learner ID, if supplied"
                    value={state.externalLearnerId}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="site"
                    label="Site"
                    value={state.site}
                    options={TRAINING_SITES}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="apprenticeship"
                    label="Apprenticeship"
                    value={state.apprenticeship}
                    options={APPRENTICESHIPS}
                    dispatch={dispatch}
                  />
                  <TextEntry
                    field="originalEntryDate"
                    label="Original first contact or entry date"
                    type="date"
                    value={state.originalEntryDate}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="enquirySource"
                    label="Enquiry source"
                    value={state.enquirySource}
                    options={ENQUIRY_SOURCES}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="responsiveness"
                    label="Responsiveness"
                    value={state.responsiveness}
                    options={RESPONSIVENESS_OPTIONS}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="employerStatus"
                    label="Employer status"
                    value={state.employerStatus}
                    options={EMPLOYER_STATUSES}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="employerId"
                    label="Employer, if known"
                    value={state.employerId}
                    options={[
                      { value: "", label: "None" },
                      ...state.employers.map((employer) => ({
                        value: employer.id,
                        label: employer.name,
                      })),
                    ]}
                    dispatch={dispatch}
                  />
                  <TextEntry
                    field="intendedIntakeDate"
                    label="Intended intake, optional"
                    type="date"
                    value={state.intendedIntakeDate}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="releaseDay"
                    label="Release day"
                    value={state.releaseDay}
                    options={RELEASE_DAYS}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="gtaTutor"
                    label="GTA tutor"
                    value={state.gtaTutor}
                    options={PREVIEW_STAFF_OPTIONS}
                    dispatch={dispatch}
                  />
                  <TextEntry
                    field="apprenticeshipStartDate"
                    label="Apprenticeship start date"
                    type="date"
                    value={state.apprenticeshipStartDate}
                    dispatch={dispatch}
                  />
                  <TextEntry
                    field="apprenticeshipPlannedEndDate"
                    label="Apprenticeship planned end date"
                    type="date"
                    value={state.apprenticeshipPlannedEndDate}
                    dispatch={dispatch}
                  />
                  <ChoiceEntry
                    field="gtaReviewer"
                    label="GTA reviewer"
                    value={state.gtaReviewer}
                    options={PREVIEW_STAFF_OPTIONS}
                    dispatch={dispatch}
                  />
                  <TextEntry
                    field="plannedReviewDate"
                    label="Planned review date"
                    type="date"
                    value={state.plannedReviewDate}
                    dispatch={dispatch}
                  />
                  <div className={styles.learnerField} data-entry-field="futureReviews">
                    <span>Future reviews</span>
                    <Select
                      aria-label="Future reviews"
                      value=""
                      disabled
                      placeholder="Enter the planned review date first"
                      options={[]}
                      onChange={() => undefined}
                    />
                  </div>
                </div>
                <label className={styles.learnerField} data-entry-field="notes">
                  <span>Notes</span>
                  <textarea
                    value={state.notes}
                    onChange={(event) =>
                      dispatch({ type: "set-entry", field: "notes", value: event.target.value })
                    }
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

function TextEntry({
  field,
  label,
  value,
  dispatch,
  required = false,
  type = "text",
}: {
  field: keyof ApprenticeEntryFields;
  label: string;
  value: string;
  dispatch: (action: { type: "set-entry"; field: keyof ApprenticeEntryFields; value: string }) => void;
  required?: boolean;
  type?: "text" | "date";
}) {
  return (
    <label className={styles.learnerField} data-entry-field={field}>
      <span>
        {label}
        {required ? <em className={styles.fieldRequired}> required</em> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => dispatch({ type: "set-entry", field, value: event.target.value })}
      />
    </label>
  );
}

function ChoiceEntry({
  field,
  label,
  value,
  options,
  dispatch,
}: {
  field: keyof ApprenticeEntryFields;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  dispatch: (action: { type: "set-entry"; field: keyof ApprenticeEntryFields; value: string }) => void;
}) {
  return (
    <div className={styles.learnerField} data-entry-field={field}>
      <span>{label}</span>
      <Select
        aria-label={label}
        value={value}
        placeholder="Select…"
        options={[...options]}
        onChange={(next) => dispatch({ type: "set-entry", field, value: next })}
      />
    </div>
  );
}
