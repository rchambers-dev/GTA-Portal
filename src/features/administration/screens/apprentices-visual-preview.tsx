"use client";

import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";

/**
 * Layout preview only. Example names are not records.
 * Controls are disabled and this component does not call the network.
 * The previous intake implementation remains in this folder for later wiring.
 */
const EXAMPLE_APPRENTICES = [
  {
    name: "Alex Example",
    reference: "EXAMPLE-0001",
    employer: "Not linked",
    gaps: "Postcode, release day, tutor",
  },
  {
    name: "Jordan Example",
    reference: "EXAMPLE-0002",
    employer: "Example Motors",
    gaps: "Reviewer, planned review",
  },
];

export function ApprenticesVisualPreview() {
  return (
    <ApprenticePageShell
      eyebrow="Apprentices"
      title="Apprentices"
      description="Layout preview with example data. Saving is disabled. Nothing here is written to the portal."
      actions={
        <button type="button" className={styles.primaryBtn} disabled>
          Add apprentice
        </button>
      }
    >
      <div className={styles.stack}>
        <p className={styles.formGroupMeta} role="status">
          EXAMPLE DATA. Preview only. Saving is disabled. These names are not real apprentices or employers.
        </p>

        <form
          className={styles.formStack}
          onSubmit={(event) => event.preventDefault()}
        >
          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Add apprentice</h2>
              <span className={styles.formGroupBadge}>Example</span>
            </div>
            <p className={styles.formGroupMeta}>
              Full name is the only required field in this layout. Leave unknown details blank. Enrolment is not part of this preview.
            </p>
            <fieldset className={styles.formGrid} disabled>
              <label className={styles.field}>
                <span>
                  Full name <em className={styles.fieldRequired}>required</em>
                </span>
                <input readOnly defaultValue="Alex Example" />
              </label>
              <label className={styles.field}>
                <span>Recorded employer name</span>
                <input readOnly defaultValue="" placeholder="Not recorded" />
              </label>
              <label className={styles.field}>
                <span>Recorded postcode</span>
                <input readOnly defaultValue="" />
              </label>
              <label className={styles.field}>
                <span>Release day</span>
                <select defaultValue="" disabled>
                  <option value="">Not recorded</option>
                  <option>Monday</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Tutor</span>
                <input readOnly defaultValue="" />
              </label>
              <label className={styles.field}>
                <span>Apprenticeship</span>
                <input readOnly defaultValue="" />
              </label>
            </fieldset>
          </section>

          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Employer, site and manager</h2>
              <span className={styles.formGroupBadge}>Optional link</span>
            </div>
            <p className={styles.formGroupMeta}>
              Optional. Example companies only. Choosing one does not save a link.
            </p>
            <fieldset className={styles.formGrid} disabled>
              <label className={styles.field}>
                <span>Employer</span>
                <select defaultValue="example-motors" disabled>
                  <option value="">Not linked</option>
                  <option value="example-motors">Example Motors</option>
                  <option value="example-yard-co">Example Yard Co</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Site</span>
                <select defaultValue="example-yard" disabled>
                  <option value="">Not recorded</option>
                  <option value="example-yard">Example yard</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Manager</span>
                <select defaultValue="example-manager" disabled>
                  <option value="">Not recorded</option>
                  <option value="example-manager">Example Manager · Example yard</option>
                </select>
              </label>
            </fieldset>
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} disabled>
                Cancel
              </button>
              <button type="submit" className={styles.primaryBtn} disabled>
                Add apprentice
              </button>
            </div>
          </section>
        </form>

        <section className={styles.formGroup}>
          <div className={styles.formGroupHead}>
            <h2 className={styles.formGroupTitle}>Example apprentices</h2>
            <span className={styles.formGroupBadge}>2</span>
          </div>
          <div className={styles.employerList}>
            {EXAMPLE_APPRENTICES.map((row) => (
              <article key={row.reference} className={styles.employerCard} data-open="false">
                <div className={styles.employerCardHeader}>
                  <div className={styles.employerCardMain}>
                    <strong className={styles.employerName}>{row.name}</strong>
                    <span>{row.reference}</span>
                    <span>Employer: {row.employer}</span>
                    <span>Not recorded: {row.gaps}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.formGroup}>
          <div className={styles.formGroupHead}>
            <h2 className={styles.formGroupTitle}>Companies, sites and managers</h2>
            <span className={styles.formGroupBadge}>Example</span>
          </div>
          <p className={styles.formGroupMeta}>
            Example only. One site can be linked to more than one company. Nothing is saved.
          </p>
          <fieldset className={styles.formGrid} disabled>
            <label className={styles.field}>
              <span>
                Company name <em className={styles.fieldRequired}>required</em>
              </span>
              <input readOnly defaultValue="Example Motors" />
            </label>
            <label className={styles.field}>
              <span>
                Site label <em className={styles.fieldRequired}>required</em>
              </span>
              <input readOnly defaultValue="Example yard" />
            </label>
            <label className={styles.field}>
              <span>
                Manager name <em className={styles.fieldRequired}>required</em>
              </span>
              <input readOnly defaultValue="Example Manager" />
            </label>
          </fieldset>
          <div className={styles.employerList}>
            <article className={styles.employerCard} data-open="false">
              <div className={styles.employerCardHeader}>
                <div className={styles.employerCardMain}>
                  <strong className={styles.employerName}>Example Motors</strong>
                  <span>Sites: Example yard</span>
                  <span>Managers: Example Manager</span>
                  <span>Apprentices: Jordan Example</span>
                </div>
              </div>
            </article>
            <article className={styles.employerCard} data-open="false">
              <div className={styles.employerCardHeader}>
                <div className={styles.employerCardMain}>
                  <strong className={styles.employerName}>Example Yard Co</strong>
                  <span>Sites: Example yard</span>
                  <span>Same physical site as Example Motors. Not the same company.</span>
                </div>
              </div>
            </article>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.primaryBtn} disabled>
              Add company
            </button>
            <button type="button" className={styles.secondaryBtn} disabled>
              Add site
            </button>
            <button type="button" className={styles.secondaryBtn} disabled>
              Add manager
            </button>
          </div>
        </section>
      </div>
    </ApprenticePageShell>
  );
}
