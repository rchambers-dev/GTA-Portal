"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { LearnerStatusChip } from "./LearnerPageShell";
import {
  AF11_ACADEMIC_YEAR,
  AF11_FORM_CODE,
  AF11_FORM_TITLE,
  AF11_FORM_VERSION,
  APPRENTICESHIP_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  ETHNICITY_OPTIONS,
  HEARD_ABOUT_OPTIONS,
  LLDD_OPTIONS,
  RESIDENCY_OPTIONS,
  canSubmitEnrolmentForm,
  emptyEmploymentRow,
  emptyQualificationRow,
  useEnrolmentFormAf11State,
  type ContactMethod,
  type EnrolmentFormAf11State,
  type YesNo,
} from "../domain/enrolment-form-af11";
import styles from "../screens/learner-pages.module.css";

function YesNoField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: YesNo;
  onChange: (value: YesNo) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className={styles.otjFieldset} disabled={disabled}>
      <legend>{label}</legend>
      <div className={styles.otjPresetRow}>
        {(["yes", "no"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={
              value === option ? styles.otjPresetActive : styles.otjPreset
            }
            onClick={() => onChange(option)}
            disabled={disabled}
          >
            {option === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

function formatSavedAt(iso: string | null) {
  if (!iso) return "Not saved yet";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function EnrolmentFormAf11Panel() {
  const {
    state,
    patch,
    persist,
    submit,
    progress,
  } = useEnrolmentFormAf11State();

  const locked = Boolean(state.signedAt);
  const ethnicityGroups = useMemo(() => {
    const groups = new Map<string, typeof ETHNICITY_OPTIONS>();
    for (const option of ETHNICITY_OPTIONS) {
      const list = groups.get(option.group) ?? [];
      list.push(option);
      groups.set(option.group, list);
    }
    return [...groups.entries()];
  }, []);

  const showPartA =
    state.employmentStatus === "employed" ||
    state.employmentStatus === "self_employed" ||
    state.employmentStatus === "voluntary" ||
    state.employmentStatus === "sole_trader";
  const showPartB = state.employmentStatus === "unemployed";

  function updateQual(
    id: string,
    partial: Partial<EnrolmentFormAf11State["qualifications"][number]>,
  ) {
    patch({
      qualifications: state.qualifications.map((row) =>
        row.id === id ? { ...row, ...partial } : row,
      ),
    });
  }

  function updatePrevEmp(
    id: string,
    partial: Partial<EnrolmentFormAf11State["previousEmployment"][number]>,
  ) {
    patch({
      previousEmployment: state.previousEmployment.map((row) =>
        row.id === id ? { ...row, ...partial } : row,
      ),
    });
  }

  function toggleContact(method: ContactMethod) {
    const exists = state.preferredContactMethods.includes(method);
    patch({
      preferredContactMethods: exists
        ? state.preferredContactMethods.filter((m) => m !== method)
        : [...state.preferredContactMethods, method],
    });
  }

  function toggleLldd(code: string) {
    const exists = state.llddCodes.includes(code);
    const next = exists
      ? state.llddCodes.filter((c) => c !== code)
      : [...state.llddCodes, code];
    patch({
      llddCodes: next,
      primaryLlddCode:
        state.primaryLlddCode && next.includes(state.primaryLlddCode)
          ? state.primaryLlddCode
          : next[0] ?? "",
    });
  }

  return (
    <div className={styles.stack}>
      <div
        className={styles.otjHealthBar}
        data-health={
          progress.status === "complete"
            ? "ahead"
            : progress.status === "in_progress"
              ? "on_track"
              : "behind"
        }
      >
        <div className={styles.otjHealthMain}>
          <p className={styles.otjHealthLabel}>
            {AF11_FORM_CODE} {AF11_FORM_VERSION} · {AF11_ACADEMIC_YEAR}
          </p>
          <p className={styles.otjHealthValue}>{AF11_FORM_TITLE}</p>
          <p className={styles.otjHealthHint}>
            ADM14 1.2 · Complete clearly. Autosave with Save draft; submit locks
            the form after declaration.
          </p>
        </div>
        <div className={styles.otjHealthSide}>
          <LearnerStatusChip
            tone={
              progress.status === "complete"
                ? "green"
                : progress.status === "in_progress"
                  ? "amber"
                  : "blue"
            }
          >
            {progress.status === "complete"
              ? "Submitted"
              : `${progress.percent}% complete`}
          </LearnerStatusChip>
          <p className={styles.glanceHint}>
            Last saved · {formatSavedAt(state.lastSavedAt)}
          </p>
        </div>
      </div>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Section 1 · Applicant&apos;s details</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Title
            <input
              value={state.title}
              disabled={locked}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            First name (as on certificates)
            <input
              value={state.firstName}
              disabled={locked}
              onChange={(e) => patch({ firstName: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Middle name(s)
            <input
              value={state.middleNames}
              disabled={locked}
              onChange={(e) => patch({ middleNames: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Surname (as on certificates)
            <input
              value={state.surname}
              disabled={locked}
              onChange={(e) => patch({ surname: e.target.value })}
            />
          </label>
        </div>
        <YesNoField
          label="Do you want middle names to appear on certificates?"
          value={state.middleNamesOnCertificate}
          disabled={locked}
          onChange={(value) => patch({ middleNamesOnCertificate: value })}
        />
        <label className={styles.field}>
          Address &amp; postcode
          <textarea
            rows={3}
            value={state.addressPostcode}
            disabled={locked}
            onChange={(e) => patch({ addressPostcode: e.target.value })}
          />
        </label>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Years at this address
            <input
              value={state.yearsAtAddress}
              disabled={locked}
              onChange={(e) => patch({ yearsAtAddress: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Home telephone
            <input
              value={state.homeTelephone}
              disabled={locked}
              onChange={(e) => patch({ homeTelephone: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Mobile telephone
            <input
              value={state.mobile}
              disabled={locked}
              onChange={(e) => patch({ mobile: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Email address
            <input
              type="email"
              value={state.email}
              disabled={locked}
              onChange={(e) => patch({ email: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Date of birth
            <input
              type="date"
              value={state.dateOfBirth}
              disabled={locked}
              onChange={(e) => patch({ dateOfBirth: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            National Insurance number
            <input
              value={state.nationalInsuranceNo}
              disabled={locked}
              onChange={(e) => patch({ nationalInsuranceNo: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Unique Learner Number (ULN)
            <input
              value={state.uln}
              disabled={locked}
              onChange={(e) => patch({ uln: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              placeholder="10-digit ULN for LRS PLR"
              inputMode="numeric"
            />
          </label>
          <label className={styles.field}>
            Age
            <input
              value={state.age}
              disabled={locked}
              onChange={(e) => patch({ age: e.target.value })}
            />
          </label>
        </div>
        <label className={styles.field}>
          Previous addresses (if less than 3 years at current address)
          <textarea
            rows={3}
            value={state.previousAddresses}
            disabled={locked}
            onChange={(e) => patch({ previousAddresses: e.target.value })}
          />
        </label>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Section 1a · Next of kin</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Title
            <input
              value={state.nokTitle}
              disabled={locked}
              onChange={(e) => patch({ nokTitle: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            First name
            <input
              value={state.nokFirstName}
              disabled={locked}
              onChange={(e) => patch({ nokFirstName: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Surname
            <input
              value={state.nokSurname}
              disabled={locked}
              onChange={(e) => patch({ nokSurname: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Relationship
            <input
              value={state.nokRelationship}
              disabled={locked}
              onChange={(e) => patch({ nokRelationship: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Email address
            <input
              type="email"
              value={state.nokEmail}
              disabled={locked}
              onChange={(e) => patch({ nokEmail: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            Mobile telephone
            <input
              value={state.nokMobile}
              disabled={locked}
              onChange={(e) => patch({ nokMobile: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Section 2 · Apprenticeship type</h2>
        <p className={styles.metaBlock}>
          Please indicate the GTA apprenticeship you would like to enrol on.
        </p>
        <div className={styles.choiceStack}>
          {APPRENTICESHIP_OPTIONS.map((option) => (
            <label key={option.value} className={styles.checkRow}>
              <input
                type="radio"
                name="apprenticeshipProgramme"
                disabled={locked}
                checked={state.apprenticeshipProgramme === option.value}
                onChange={() =>
                  patch({ apprenticeshipProgramme: option.value })
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {state.apprenticeshipProgramme === "other" ? (
          <label className={styles.field}>
            Other apprenticeship notes
            <textarea
              rows={2}
              value={state.apprenticeshipOtherNotes}
              disabled={locked}
              onChange={(e) =>
                patch({ apprenticeshipOtherNotes: e.target.value })
              }
            />
          </label>
        ) : null}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Section 3 · Evidence of eligibility</h2>
        <p className={styles.metaBlock}>
          Tick which residency route applies. You will be asked to produce
          original evidence at interview.
        </p>
        <div className={styles.choiceStack}>
          {RESIDENCY_OPTIONS.map((option) => (
            <label key={option.value} className={styles.checkRow}>
              <input
                type="radio"
                name="residencyEligibility"
                disabled={locked}
                checked={state.residencyEligibility === option.value}
                onChange={() =>
                  patch({ residencyEligibility: option.value })
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Country of birth
            <input
              value={state.countryOfBirth}
              disabled={locked}
              onChange={(e) => patch({ countryOfBirth: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            UK residency start date (if born outside UK)
            <input
              type="date"
              value={state.ukResidencyStartDate}
              disabled={locked}
              onChange={(e) => patch({ ukResidencyStartDate: e.target.value })}
            />
          </label>
        </div>
        <YesNoField
          label="Any restrictions on your residency in the UK?"
          value={state.residencyRestrictions}
          disabled={locked}
          onChange={(value) => patch({ residencyRestrictions: value })}
        />
        {state.residencyRestrictions === "yes" ? (
          <label className={styles.field}>
            Residency restriction details
            <textarea
              rows={2}
              value={state.residencyRestrictionsDetails}
              disabled={locked}
              onChange={(e) =>
                patch({ residencyRestrictionsDetails: e.target.value })
              }
            />
          </label>
        ) : null}
        <YesNoField
          label="Any restrictions on your right to work in England?"
          value={state.rightToWorkRestrictions}
          disabled={locked}
          onChange={(value) => patch({ rightToWorkRestrictions: value })}
        />
        {state.rightToWorkRestrictions === "yes" ? (
          <label className={styles.field}>
            Right-to-work restriction details
            <textarea
              rows={2}
              value={state.rightToWorkRestrictionsDetails}
              disabled={locked}
              onChange={(e) =>
                patch({ rightToWorkRestrictionsDetails: e.target.value })
              }
            />
          </label>
        ) : null}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Section 4 · Education history</h2>
        <YesNoField
          label="Are you currently enrolled on any other training course?"
          value={state.currentlyOnOtherCourse}
          disabled={locked}
          onChange={(value) => patch({ currentlyOnOtherCourse: value })}
        />
        {state.currentlyOnOtherCourse === "yes" ? (
          <label className={styles.field}>
            Course details
            <textarea
              rows={2}
              value={state.otherCourseDetails}
              disabled={locked}
              onChange={(e) => patch({ otherCourseDetails: e.target.value })}
            />
          </label>
        ) : null}
        <div className={styles.formGrid}>
          <YesNoField
            label="Have you officially left school?"
            value={state.leftSchool}
            disabled={locked}
            onChange={(value) => patch({ leftSchool: value })}
          />
          <label className={styles.field}>
            Planned end date of current training course
            <input
              type="date"
              value={state.plannedEndDateCurrentCourse}
              disabled={locked}
              onChange={(e) =>
                patch({ plannedEndDateCurrentCourse: e.target.value })
              }
            />
          </label>
        </div>
        <p className={styles.metaBlock}>
          List previous qualifications (or predicted results if still waiting),
          including highest Numeracy, Literacy and ICT. Photocopy or scan
          certificates and attach with this form when submitting on paper; in
          the portal, GTA staff can link evidence after interview.
        </p>
        <ul className={styles.list}>
          {state.qualifications.map((row, index) => (
            <li key={row.id} className={styles.row}>
              <div className={styles.formGrid} style={{ width: "100%" }}>
                <label className={styles.field}>
                  Qualification / predicted {index + 1}
                  <input
                    value={row.qualification}
                    disabled={locked}
                    onChange={(e) =>
                      updateQual(row.id, { qualification: e.target.value })
                    }
                  />
                </label>
                <label className={styles.field}>
                  Grade
                  <input
                    value={row.grade}
                    disabled={locked}
                    onChange={(e) =>
                      updateQual(row.id, { grade: e.target.value })
                    }
                  />
                </label>
                <label className={styles.field}>
                  Achievement date
                  <input
                    type="date"
                    value={row.achievementDate}
                    disabled={locked}
                    onChange={(e) =>
                      updateQual(row.id, { achievementDate: e.target.value })
                    }
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
        {!locked ? (
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() =>
              patch({
                qualifications: [
                  ...state.qualifications,
                  emptyQualificationRow(),
                ],
              })
            }
          >
            Add qualification row
          </button>
        ) : null}

        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Please confirm</legend>
          <CheckRow
            checked={state.confirmNotOnOtherApprenticeship}
            disabled={locked}
            onChange={(checked) =>
              patch({ confirmNotOnOtherApprenticeship: checked })
            }
          >
            I am not currently enrolled on another apprenticeship
          </CheckRow>
          <CheckRow
            checked={state.confirmNotAebConflict}
            disabled={locked}
            onChange={(checked) => patch({ confirmNotAebConflict: checked })}
          >
            I am not currently undertaking training funded through AEB that
            takes place within working hours and/or replicates training or
            offers career-related training which conflicts with the
            apprenticeship
          </CheckRow>
          <CheckRow
            checked={state.confirmNotOtherDfeFunding}
            disabled={locked}
            onChange={(checked) =>
              patch({ confirmNotOtherDfeFunding: checked })
            }
          >
            I am not currently in receipt of any other DfE funding
          </CheckRow>
          <CheckRow
            checked={state.confirmNotSandwichPlacement}
            disabled={locked}
            onChange={(checked) =>
              patch({ confirmNotSandwichPlacement: checked })
            }
          >
            I am not currently on a sandwich placement as part of a degree
          </CheckRow>
        </fieldset>
        <label className={styles.field}>
          If enrolled on an apprenticeship in the last 6 months, provide details
          <textarea
            rows={3}
            value={state.priorApprenticeshipLast6Months}
            disabled={locked}
            onChange={(e) =>
              patch({ priorApprenticeshipLast6Months: e.target.value })
            }
          />
        </label>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Section 5 · Employment history</h2>
        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Current status</legend>
          <div className={styles.choiceStack}>
            {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
              <label key={option.value} className={styles.checkRow}>
                <input
                  type="radio"
                  name="employmentStatus"
                  disabled={locked}
                  checked={state.employmentStatus === option.value}
                  onChange={() =>
                    patch({ employmentStatus: option.value })
                  }
                />
                <span>
                  {option.label} (go to Part {option.part})
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {showPartA ? (
          <>
            <h3 className={styles.sectionTitle}>Part A</h3>
            <p className={styles.metaBlock}>
              You must be employed under a contract covering the full
              apprenticeship including EPA. Self-employed / sole trader /
              director without a separate identifiable line manager is not
              fundable.
            </p>
            <YesNoField
              label="Do you have a contract of employment?"
              value={state.hasEmploymentContract}
              disabled={locked}
              onChange={(value) => patch({ hasEmploymentContract: value })}
            />
            <div className={styles.formGrid}>
              <label className={styles.field}>
                Contracted weekly hours
                <input
                  value={state.contractedWeeklyHours}
                  disabled={locked}
                  onChange={(e) =>
                    patch({ contractedWeeklyHours: e.target.value })
                  }
                />
              </label>
              <fieldset className={styles.otjFieldset} disabled={locked}>
                <legend>Permanent or temporary?</legend>
                <div className={styles.otjPresetRow}>
                  {(["permanent", "temporary"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={
                        state.contractType === option
                          ? styles.otjPresetActive
                          : styles.otjPreset
                      }
                      disabled={locked}
                      onClick={() => patch({ contractType: option })}
                    >
                      {option === "permanent" ? "Permanent" : "Temporary"}
                    </button>
                  ))}
                </div>
              </fieldset>
              {state.contractType === "temporary" ? (
                <label className={styles.field}>
                  Temporary contract expiry
                  <input
                    type="date"
                    value={state.temporaryContractExpiry}
                    disabled={locked}
                    onChange={(e) =>
                      patch({ temporaryContractExpiry: e.target.value })
                    }
                  />
                </label>
              ) : null}
              <YesNoField
                label="Do you work at least 50% of working hours in England?"
                value={state.work50PercentEngland}
                disabled={locked}
                onChange={(value) => patch({ work50PercentEngland: value })}
              />
              <label className={styles.field}>
                Employment start date
                <input
                  type="date"
                  value={state.employmentStartDate}
                  disabled={locked}
                  onChange={(e) =>
                    patch({ employmentStartDate: e.target.value })
                  }
                />
              </label>
            </div>
            {state.work50PercentEngland === "no" ? (
              <label className={styles.field}>
                Further details (if less than 50% in England)
                <textarea
                  rows={2}
                  value={state.workEnglandDetails}
                  disabled={locked}
                  onChange={(e) =>
                    patch({ workEnglandDetails: e.target.value })
                  }
                />
              </label>
            ) : null}
            <div className={styles.formGrid}>
              <label className={styles.field}>
                Name of employer
                <input
                  value={state.employerName}
                  disabled={locked}
                  onChange={(e) => patch({ employerName: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                Line manager
                <input
                  value={state.lineManager}
                  disabled={locked}
                  onChange={(e) => patch({ lineManager: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                Employer telephone
                <input
                  value={state.employerTelephone}
                  disabled={locked}
                  onChange={(e) =>
                    patch({ employerTelephone: e.target.value })
                  }
                />
              </label>
              <label className={styles.field}>
                Employer email
                <input
                  type="email"
                  value={state.employerEmail}
                  disabled={locked}
                  onChange={(e) => patch({ employerEmail: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                Job role
                <input
                  value={state.jobRole}
                  disabled={locked}
                  onChange={(e) => patch({ jobRole: e.target.value })}
                />
              </label>
            </div>
            <label className={styles.field}>
              Employer address &amp; postcode
              <textarea
                rows={2}
                value={state.employerAddress}
                disabled={locked}
                onChange={(e) => patch({ employerAddress: e.target.value })}
              />
            </label>
          </>
        ) : null}

        {showPartB ? (
          <>
            <h3 className={styles.sectionTitle}>Part B</h3>
            <fieldset className={styles.otjFieldset} disabled={locked}>
              <legend>I am currently unemployed and have been for</legend>
              <div className={styles.otjPresetRow}>
                {(
                  [
                    ["lt_6", "Less than 6 months"],
                    ["6_12", "6–12 months"],
                    ["12_23", "12–23 months"],
                    ["24_35", "24–35 months"],
                    ["over_36", "Over 36 months"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      state.unemployedDuration === value
                        ? styles.otjPresetActive
                        : styles.otjPreset
                    }
                    disabled={locked}
                    onClick={() => patch({ unemployedDuration: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className={styles.metaBlock}>
              Previous employment (company, job role, dates)
            </p>
            <ul className={styles.list}>
              {state.previousEmployment.map((row) => (
                <li key={row.id} className={styles.row}>
                  <div className={styles.formGrid} style={{ width: "100%" }}>
                    <label className={styles.field}>
                      Company name
                      <input
                        value={row.companyName}
                        disabled={locked}
                        onChange={(e) =>
                          updatePrevEmp(row.id, {
                            companyName: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      Job role
                      <input
                        value={row.jobRole}
                        disabled={locked}
                        onChange={(e) =>
                          updatePrevEmp(row.id, { jobRole: e.target.value })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      Dates of employment
                      <input
                        value={row.dates}
                        disabled={locked}
                        onChange={(e) =>
                          updatePrevEmp(row.id, { dates: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            {!locked ? (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() =>
                  patch({
                    previousEmployment: [
                      ...state.previousEmployment,
                      emptyEmploymentRow(),
                    ],
                  })
                }
              >
                Add previous employment
              </button>
            ) : null}
          </>
        ) : null}
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>
          Section 6 · Confidential information
        </h2>
        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Sex</legend>
          <div className={styles.otjPresetRow}>
            {(
              [
                ["male", "Male"],
                ["female", "Female"],
                ["prefer_not", "Prefer not to say"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  state.sex === value ? styles.otjPresetActive : styles.otjPreset
                }
                disabled={locked}
                onClick={() => patch({ sex: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Ethnicity</legend>
          {ethnicityGroups.map(([group, options]) => (
            <div key={group} className={styles.choiceStack}>
              <p className={styles.glanceLabel}>{group}</p>
              {options.map((option) => (
                <label key={option.code} className={styles.checkRow}>
                  <input
                    type="radio"
                    name="ethnicityCode"
                    disabled={locked}
                    checked={state.ethnicityCode === option.code}
                    onChange={() => patch({ ethnicityCode: option.code })}
                  />
                  <span>
                    {option.code}. {option.label}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </fieldset>

        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>
            Learning difficulties, disabilities and health (tick all that
            apply; mark primary with the selector below)
          </legend>
          <div className={styles.choiceStack}>
            {LLDD_OPTIONS.map((option) => (
              <label key={option.code} className={styles.checkRow}>
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={state.llddCodes.includes(option.code)}
                  onChange={() => toggleLldd(option.code)}
                />
                <span>
                  {option.code}. {option.label}
                </span>
              </label>
            ))}
          </div>
          {state.llddCodes.length > 0 ? (
            <label className={styles.field}>
              Most significant / primary difficulty or disability
              <select
                value={state.primaryLlddCode}
                disabled={locked}
                onChange={(e) => patch({ primaryLlddCode: e.target.value })}
              >
                {state.llddCodes.map((code) => {
                  const option = LLDD_OPTIONS.find((o) => o.code === code);
                  return (
                    <option key={code} value={code}>
                      {code}. {option?.label ?? code}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : null}
        </fieldset>

        <label className={styles.field}>
          Details of health conditions, disabilities, learning difficulties,
          medical conditions, allergies, intolerances, mental health needs, or
          other circumstances that may affect participation
          <textarea
            rows={4}
            value={state.healthSupportDetails}
            disabled={locked}
            onChange={(e) => patch({ healthSupportDetails: e.target.value })}
          />
        </label>

        <div className={styles.formGrid}>
          <YesNoField
            label="Known or previously known to youth justice services?"
            value={state.knownToYouthJustice}
            disabled={locked}
            onChange={(value) => patch({ knownToYouthJustice: value })}
          />
          <YesNoField
            label="On an Education, Health and Care plan (EHCP)?"
            value={state.hasEhcp}
            disabled={locked}
            onChange={(value) => patch({ hasEhcp: value })}
          />
          <YesNoField
            label="Happy for the details above to be shared with your employer?"
            value={state.shareDetailsWithEmployer}
            disabled={locked}
            onChange={(value) => patch({ shareDetailsWithEmployer: value })}
          />
        </div>

        <CheckRow
          checked={state.careLeaverBursary}
          disabled={locked}
          onChange={(checked) => patch({ careLeaverBursary: checked })}
        >
          I confirm that I am a care leaver (16–24, or 15 if 16th birthday falls
          between last Friday of June and 31 August) looked after by a UK local
          authority or health and social care trust at some point since age 14
          and in care on or after 16th birthday — GTA will contact about bursary
          eligibility.
        </CheckRow>

        <p className={styles.metaBlock}>
          Personal information is passed to the Department for Education to meet
          legal duties under the Apprenticeships, Skills, Children and Learning
          Act 2009, and for the Learning Records Service to create and maintain
          a ULN. See GTA policy CP7.8 Data Protection &amp; Retention.
        </p>

        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Preferred method of contact</legend>
          <div className={styles.otjPresetRow}>
            {CONTACT_METHOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  state.preferredContactMethods.includes(option.value)
                    ? styles.otjPresetActive
                    : styles.otjPreset
                }
                disabled={locked}
                onClick={() => toggleContact(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>How did you hear about the GTA?</legend>
          <div className={styles.choiceStack}>
            {HEARD_ABOUT_OPTIONS.map((option) => (
              <label key={option.value} className={styles.checkRow}>
                <input
                  type="radio"
                  name="heardAboutGta"
                  disabled={locked}
                  checked={state.heardAboutGta === option.value}
                  onChange={() => patch({ heardAboutGta: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className={styles.otjForm}>
        <h2 className={styles.sectionTitle}>Declaration</h2>
        <fieldset className={styles.otjFieldset} disabled={locked}>
          <legend>Please tick to confirm</legend>
          <CheckRow
            checked={state.declarePrivacyUnderstood}
            disabled={locked}
            onChange={(checked) =>
              patch({ declarePrivacyUnderstood: checked })
            }
          >
            I have read and understood the privacy notice and the Data
            Protection and Retention Policy for Doncaster, Rotherham and
            District Motor Trades GTA Ltd.
          </CheckRow>
          <CheckRow
            checked={state.declareInformationAccurate}
            disabled={locked}
            onChange={(checked) =>
              patch({ declareInformationAccurate: checked })
            }
          >
            The information and data I have provided is true, accurate and
            complete to the best of my knowledge.
          </CheckRow>
          <CheckRow
            checked={state.declareConsentProcessing}
            disabled={locked}
            onChange={(checked) =>
              patch({ declareConsentProcessing: checked })
            }
          >
            I consent to GTA using the information provided as set out in the
            Privacy Notice for Apprenticeships and the Data Protection and
            Retention Policy, including sharing with my employer.
          </CheckRow>
          <CheckRow
            checked={state.declareResidencyEligible}
            disabled={locked}
            onChange={(checked) =>
              patch({ declareResidencyEligible: checked })
            }
          >
            Learner residency eligibility: I confirm I meet the residency /
            citizenship requirements for apprenticeship funding as set out on
            this form.
          </CheckRow>
          <CheckRow
            checked={state.declareRightToWork}
            disabled={locked}
            onChange={(checked) => patch({ declareRightToWork: checked })}
          >
            I confirm that I have the Right to Work in England.
          </CheckRow>
        </fieldset>
        <p className={styles.metaBlock}>
          You may withdraw consent in writing to admin@doncastergta.co.uk. This
          does not affect lawful processing before withdrawal.
        </p>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            Learner full name (signature)
            <input
              value={state.signatureName}
              disabled={locked}
              onChange={(e) => patch({ signatureName: e.target.value })}
              placeholder="Type your full name to sign"
            />
          </label>
        </div>
        {state.signedAt ? (
          <p className={styles.metaBlock}>
            Submitted {formatSavedAt(state.signedAt)} by {state.signatureName}.
            Form is locked — contact GTA admin if a correction is needed.
          </p>
        ) : null}
        <div className={styles.otjChipRow}>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={locked}
            onClick={() => persist()}
          >
            Save draft
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={locked || !canSubmitEnrolmentForm(state)}
            onClick={() => submit()}
          >
            Submit enrolment form
          </button>
        </div>
      </section>
    </div>
  );
}
