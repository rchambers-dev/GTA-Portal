"use client";

import Link from "next/link";
import { useState } from "react";
import { FormField, Select, TextInput } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  createApprentice,
  createEnrolment,
  createUser,
  updateApprentice,
  type ApprenticeInput,
} from "../domain/store";
import { workspaceForRole } from "../domain/account-access";
import {
  awaitingEnrolment,
  missingPersonalFields,
} from "../domain/intake-pack";
import { formatCollegeDaysShort } from "../domain/college-days";
import { plannedDatesFromStart } from "../domain/programme-duration";
import {
  suggestCohortForLearnerStart,
} from "../domain/cohort-intake";
import {
  formatGtaProgrammeVersionLabel,
  selectableGtaVersionsForIntake,
} from "../domain/gta-programme-version-options";
import {
  formatTeachingGroupOptionLabel,
  teachingGroupsCompatibleWithPin,
  currentMemberCount,
} from "../domain/teaching-group-placement";
import type { AdminApprenticeRecord, AdminCohortRecord } from "../domain/types";
import { useAdminStore } from "../hooks/useAdminStore";
import { ApprenticesVisualPreview } from "./apprentices-visual-preview";
import styles from "./admin-pages.module.css";

type PersonalForm = Omit<ApprenticeInput, "intakeStatus">;

type CreateForm = {
  firstName: string;
  lastName: string;
  email: string;
  programmeId: string;
  employerId: string;
  cohortId: string;
  gtaProgrammeVersionId: string;
  teachingGroupId: string;
  mentorName: string;
  tutorName: string;
  apprenticeshipStartDate: string;
  apprenticeshipEndDate: string;
  practicalStartDate: string;
  practicalEndDate: string;
  collegeDays: string;
};

function emptyPersonalForm(): PersonalForm {
  return {
    displayName: "",
    apprenticeReference: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    uln: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    supportNotes: "",
    notes: "",
  };
}

function emptyCreateForm(): CreateForm {
  return {
    firstName: "",
    lastName: "",
    email: "",
    programmeId: "",
    employerId: "",
    cohortId: "",
    gtaProgrammeVersionId: "",
    teachingGroupId: "",
    mentorName: "",
    tutorName: "",
    apprenticeshipStartDate: "",
    apprenticeshipEndDate: "",
    practicalStartDate: "",
    practicalEndDate: "",
    collegeDays: "",
  };
}

function displayNameFromCreate(form: CreateForm): string {
  return [form.firstName, form.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function learnerDatesFromStart(
  startDate: string,
  durationMonths: number | undefined,
): Pick<
  CreateForm,
  | "apprenticeshipStartDate"
  | "apprenticeshipEndDate"
  | "practicalStartDate"
  | "practicalEndDate"
> {
  const planned = plannedDatesFromStart(startDate, durationMonths);
  return {
    apprenticeshipStartDate: startDate,
    practicalStartDate: startDate,
    practicalEndDate: planned.practicalEndDate,
    apprenticeshipEndDate:
      planned.apprenticeshipEndDate || planned.practicalEndDate,
  };
}

function clearGroupPlacement(): Pick<
  CreateForm,
  "cohortId" | "gtaProgrammeVersionId" | "teachingGroupId" | "tutorName" | "collegeDays"
> {
  return {
    cohortId: "",
    gtaProgrammeVersionId: "",
    teachingGroupId: "",
    tutorName: "",
    collegeDays: "",
  };
}

function withLearnerStart(
  prev: CreateForm,
  startDate: string,
  durationMonths: number | undefined,
  cohorts: AdminCohortRecord[],
  standardCode: string,
): CreateForm {
  const dates = learnerDatesFromStart(startDate, durationMonths);
  if (!startDate || !standardCode) {
    return { ...prev, ...dates };
  }
  const suggestion = suggestCohortForLearnerStart({
    cohorts,
    standardCode,
    apprenticeshipStartDate: startDate,
  });
  const nextCohortId = suggestion.cohort?.id ?? "";
  return {
    ...prev,
    ...dates,
    cohortId: nextCohortId,
  };
}

function canMarkReady(row: PersonalForm | AdminApprenticeRecord): boolean {
  return Boolean(
    row.displayName.trim() && row.dateOfBirth && row.email.trim(),
  );
}

function IntakeInlineField({
  label,
  value,
  onCommit,
  type = "text",
  placeholder,
  required = false,
  wide = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  type?: "text" | "email" | "tel" | "date";
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  function commit() {
    if (draft.trim() !== value.trim()) onCommit(draft);
    else setDraft(value);
  }

  return (
    <label
      className={`${styles.detailField}${wide ? ` ${styles.detailFieldWide}` : ""}`}
    >
      <span className={styles.detailFieldLabel}>
        {label}
        {required ? <em className={styles.fieldRequired}>required</em> : null}
      </span>
      {multiline ? (
        <textarea
          className={styles.detailFieldInput}
          value={draft}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          className={styles.detailFieldInput}
          type={type}
          value={draft}
          placeholder={placeholder}
          data-empty={required && !value.trim() ? "true" : "false"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      )}
    </label>
  );
}

/**
 * Apprentice Intake — same create form as Temp Portal: account + placement
 * on one page. Extra personal fields can be finished afterwards.
 */
/** Live intake implementation, kept for later wiring. Not rendered while the layout preview is on. */
export function AdminApprenticeIntakeScreenLive() {
  const store = useAdminStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(() =>
    emptyCreateForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [overCapacityRetry, setOverCapacityRetry] = useState<
    (() => Promise<void>) | null
  >(null);
  const [lastReadyId, setLastReadyId] = useState<string | null>(null);

  const enrolledApprenticeIds = store.enrolments.map((e) => e.apprenticeId);

  const queue = [...store.apprentices]
    .filter((apprentice) => apprentice.intakeStatus === "in_progress")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const readyAwaiting = awaitingEnrolment(
    store.apprentices,
    enrolledApprenticeIds,
  );

  const active = activeId
    ? (store.apprentices.find((l) => l.id === activeId) ?? null)
    : null;

  const selectedProgramme = store.programmes.find(
    (p) => p.id === createForm.programmeId,
  );
  const selectedCohort = store.cohorts.find(
    (c) => c.id === createForm.cohortId,
  );
  const cohortsForProgramme = selectedProgramme
    ? store.cohorts.filter(
        (c) =>
          c.programmeId === selectedProgramme.id ||
          c.standardCode.toUpperCase() ===
            selectedProgramme.standardCode.toUpperCase(),
      )
    : [];
  const cohortSuggestion =
    selectedProgramme && createForm.apprenticeshipStartDate
      ? suggestCohortForLearnerStart({
          cohorts: store.cohorts,
          standardCode: selectedProgramme.standardCode,
          apprenticeshipStartDate: createForm.apprenticeshipStartDate,
        })
      : null;

  const gtaVersionsForIntake = selectedCohort
    ? selectableGtaVersionsForIntake({
        versions: store.gtaProgrammeVersions ?? [],
        standardCode: selectedCohort.standardCode,
        skillsEnglandVersion: selectedCohort.standardVersion,
        includeId: createForm.gtaProgrammeVersionId,
      })
    : [];
  const compatibleGroups = teachingGroupsCompatibleWithPin(
    store.teachingGroups ?? [],
    createForm.gtaProgrammeVersionId,
  );

  function closeEditor() {
    setActiveId(null);
    setCreating(false);
    setError(null);
    setBusy(false);
    setOverCapacityRetry(null);
  }

  function startNew() {
    setSuccess(null);
    setError(null);
    setOverCapacityRetry(null);
    setCreateForm(emptyCreateForm());
    setActiveId(null);
    setCreating(true);
  }

  function resume(apprentice: AdminApprenticeRecord) {
    setSuccess(null);
    setError(null);
    setCreating(false);
    setActiveId(apprentice.id);
  }

  async function submitCreate(allowOverCapacity = false) {
    const displayName = displayNameFromCreate(createForm);
    if (
      !createForm.firstName.trim() ||
      !createForm.lastName.trim() ||
      !createForm.email.trim()
    ) {
      setError("Enter the apprentice’s first name, last name and email.");
      return;
    }
    const programme = store.programmes.find(
      (p) => p.id === createForm.programmeId,
    );
    if (!programme) {
      setError("Choose an apprenticeship.");
      return;
    }
    const employer = store.employers.find(
      (e) => e.id === createForm.employerId,
    );
    if (!employer) {
      setError("Choose a garage / employer.");
      return;
    }
    if (!createForm.apprenticeshipStartDate) {
      setError("Enter the apprentice’s apprenticeship start date.");
      return;
    }
    if (!createForm.apprenticeshipEndDate) {
      setError(
        "Planned end date is required. It fills from the programme duration once a start date is set.",
      );
      return;
    }
    if (!createForm.cohortId) {
      setError(
        "Choose the intake / cohort. A suggestion appears from the apprenticeship start date when a compatible intake exists.",
      );
      return;
    }
    if (!createForm.gtaProgrammeVersionId) {
      setError(
        gtaVersionsForIntake.length === 0
          ? "No published GTA Programme Version is compatible with this intake’s Skills England version. Publish a matching version before adding the apprentice — the newest version will not be chosen automatically."
          : "Choose the GTA Programme Version this apprentice will follow.",
      );
      return;
    }
    if (compatibleGroups.length > 0 && !createForm.teachingGroupId) {
      setError("Choose a teaching group that delivers the pinned GTA Programme Version.");
      return;
    }

    const emailKey = createForm.email.trim().toLowerCase();
    if (store.apprentices.some((a) => a.email.trim().toLowerCase() === emailKey)) {
      setError("An apprentice with that email already exists.");
      return;
    }

    try {
      setBusy(true);
      const created = await createApprentice({
        ...emptyPersonalForm(),
        displayName,
        email: createForm.email.trim(),
        intakeStatus: "in_progress",
      });

      try {
        await createEnrolment({
          kind: "new_starter",
          apprenticeId: created.id,
          displayName: created.displayName,
          email: created.email,
          phone: "",
          dateOfBirth: "",
          uln: "",
          programmeName: programme.name,
          standardCode: programme.standardCode,
          gtaProgrammeVersionId: createForm.gtaProgrammeVersionId || null,
          cohortId: createForm.cohortId || null,
          teachingGroupId: createForm.teachingGroupId || null,
          allowOverCapacity,
          employerId: employer.id,
          employerName: employer.name,
          workplaceContact: employer.mainContact ?? "",
          mentorName: createForm.mentorName.trim(),
          tutorName: createForm.tutorName.trim(),
          startDate: createForm.apprenticeshipStartDate,
          originalPlannedEndDate: createForm.apprenticeshipEndDate,
          programmeYear: 1,
          programmeWeek: 1,
          attendancePercent: null,
          actualProgressPercent: null,
          collegeDays: createForm.collegeDays.trim(),
          notes: "",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!allowOverCapacity && /full/i.test(message)) {
          setError(`${message} Confirm below to add over capacity.`);
          setOverCapacityRetry(() => async () => {
            setOverCapacityRetry(null);
            setError(null);
            await submitCreate(true);
          });
          return;
        }
        throw err;
      }

      try {
        await createUser({
          displayName,
          email: createForm.email.trim(),
          role: "Apprentice",
          workspace: workspaceForRole("Apprentice"),
          jobTitles: [],
          linkedEnrolmentId: null,
          linkedApprenticeId: created.id,
          linkedEmployerId: employer.id,
          programmeStartDate: createForm.apprenticeshipStartDate || null,
          status: "invited",
        });
      } catch {
        // Portal login can be set up later from Account Setup if create fails.
      }

      setSuccess(
        `${displayName} added with enrolment — enable their environment from Apprentice Account Setup when ready. A 12-character login password will be created when you enable them.`,
      );
      setError(null);
      setOverCapacityRetry(null);
      setCreateForm(emptyCreateForm());
      setCreating(false);
      setActiveId(created.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create apprentice.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeIntake(apprentice: AdminApprenticeRecord) {
    if (!canMarkReady(apprentice)) {
      setError(
        "Name, date of birth and email are needed before intake can be marked ready.",
      );
      return;
    }
    await updateApprentice(apprentice.id, { intakeStatus: "ready" });
    setSuccess(
      `${apprentice.displayName} is on the system. Open their apprentice pack for programme documents.`,
    );
    setLastReadyId(apprentice.id);
    closeEditor();
  }

  if (creating) {
    return (
      <ApprenticePageShell
        eyebrow="Administration · Apprentice Intake"
        title="Add an apprentice"
        description="Capture login, personal details and placement once. Enrolment is created from this form."
      >
        <div className={styles.stack}>
          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Add an apprentice</h2>
              <span className={styles.formGroupBadge}>Account</span>
            </div>
            <p className={styles.formGroupMeta}>
              They start as awaiting enable. A 12-character login password
              (letters, numbers and symbols) is created automatically when you
              enable them — that&apos;s what goes in their email so they can
              sign in. Placement feeds Enrolments.
            </p>
            <div className={styles.formGrid}>
              <FormField label="First name">
                <TextInput
                  value={createForm.firstName}
                  autoFocus
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label="Last name">
                <TextInput
                  value={createForm.lastName}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label="Email">
                <TextInput
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </section>

          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Placement</h2>
              <span className={styles.formGroupBadge}>Where they go</span>
            </div>
            <p className={styles.formGroupMeta}>
              Choose the garage, apprenticeship, then this apprentice&apos;s
              own start date. Intake / cohort is an administrative grouping —
              it does not set their apprenticeship dates. Pin a GTA Programme
              Version next, then a compatible teaching group supplies tutor
              and college days.
            </p>
            <div className={styles.formGrid}>
              <FormField label="Garage / employer">
                <Select
                  value={createForm.employerId}
                  placeholder="Choose garage…"
                  options={[
                    { value: "", label: "Choose garage…" },
                    ...store.employers
                      .filter((e) => e.status === "active")
                      .map((e) => ({
                        value: e.id,
                        label: e.name,
                      })),
                  ]}
                  onChange={(employerId) => {
                    const employer = store.employers.find(
                      (e) => e.id === employerId,
                    );
                    setCreateForm((prev) => ({
                      ...prev,
                      employerId,
                      mentorName: employer?.mainContact?.trim() || "",
                    }));
                  }}
                />
              </FormField>
              <FormField
                label="Workplace mentor"
                hint="Filled from the garage contact — edit if this apprentice has a different mentor"
              >
                <TextInput
                  value={createForm.mentorName}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      mentorName: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label="Apprenticeship">
                <Select
                  value={createForm.programmeId}
                  placeholder="Choose apprenticeship…"
                  options={[
                    { value: "", label: "Choose apprenticeship…" },
                    ...store.programmes
                      .filter((p) => p.status === "active")
                      .map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.standardCode})`,
                      })),
                  ]}
                  onChange={(programmeId) => {
                    const programme = store.programmes.find(
                      (p) => p.id === programmeId,
                    );
                    setCreateForm((prev) =>
                      withLearnerStart(
                        { ...prev, programmeId, ...clearGroupPlacement() },
                        prev.apprenticeshipStartDate,
                        programme?.durationMonths,
                        store.cohorts,
                        programme?.standardCode ?? "",
                      ),
                    );
                  }}
                />
              </FormField>
              <FormField
                label="Apprenticeship start date"
                hint="This apprentice’s own start — not the intake start. Can be a future date."
              >
                <TextInput
                  type="date"
                  value={createForm.apprenticeshipStartDate}
                  onChange={(e) => {
                    const startDate = e.target.value;
                    setCreateForm((prev) =>
                      withLearnerStart(
                        prev,
                        startDate,
                        selectedProgramme?.durationMonths,
                        store.cohorts,
                        selectedProgramme?.standardCode ?? "",
                      ),
                    );
                  }}
                />
              </FormField>
              <FormField
                label="Planned end date"
                hint={
                  selectedProgramme?.durationMonths
                    ? `Filled from this apprentice’s start + ${selectedProgramme.durationMonths} months typical duration plus EPA. Edit if needed.`
                    : "Fills from the programme duration once a start date is set."
                }
              >
                <TextInput
                  type="date"
                  value={createForm.apprenticeshipEndDate}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      apprenticeshipEndDate: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField
                label="Cohort / intake"
                hint={
                  !selectedProgramme
                    ? "Choose an apprenticeship first"
                    : !createForm.apprenticeshipStartDate
                      ? "Enter the apprenticeship start date to suggest an intake"
                      : cohortSuggestion?.reason === "review"
                        ? cohortSuggestion.message
                        : cohortsForProgramme.length === 0
                          ? "No intakes for this apprenticeship yet — add one on Cohorts"
                          : cohortSuggestion?.cohort
                            ? `Suggested from apprenticeship start. Intake Start is ${formatDate(cohortSuggestion.cohort.startDate)} — this does not change the apprentice’s dates.`
                            : "Intake grouping only — does not set this apprentice’s dates."
                }
              >
                <Select
                  value={createForm.cohortId}
                  disabled={
                    !selectedProgramme || cohortsForProgramme.length === 0
                  }
                  placeholder={
                    !selectedProgramme
                      ? "Choose apprenticeship first…"
                      : "Choose intake…"
                  }
                  options={[
                    {
                      value: "",
                      label: !selectedProgramme
                        ? "Choose apprenticeship first…"
                        : "Choose intake…",
                    },
                    ...cohortsForProgramme.map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.status})`,
                    })),
                  ]}
                  onChange={(cohortId) => {
                    setCreateForm((prev) => {
                      if (!cohortId) {
                        return {
                          ...prev,
                          cohortId: "",
                          gtaProgrammeVersionId: "",
                          teachingGroupId: "",
                          tutorName: "",
                          collegeDays: "",
                        };
                      }
                      return {
                        ...prev,
                        cohortId,
                        gtaProgrammeVersionId: "",
                        teachingGroupId: "",
                        tutorName: "",
                        collegeDays: "",
                      };
                    });
                  }}
                />
              </FormField>
              <FormField
                label="GTA Programme Version"
                hint={
                  !createForm.cohortId
                    ? "Choose an intake first — it sets the Skills England version this pin must match"
                    : gtaVersionsForIntake.length === 0
                      ? "No published GTA Programme Version matches this intake’s Skills England version. Newest will not be chosen automatically."
                      : "Pin the curriculum version this apprentice will follow. Teaching Groups are filtered by this pin, not by intake."
                }
              >
                <Select
                  value={createForm.gtaProgrammeVersionId}
                  disabled={!createForm.cohortId || gtaVersionsForIntake.length === 0}
                  placeholder={
                    !createForm.cohortId
                      ? "Choose intake first…"
                      : "Choose GTA Programme Version…"
                  }
                  options={[
                    {
                      value: "",
                      label: !createForm.cohortId
                        ? "Choose intake first…"
                        : "Choose GTA Programme Version…",
                    },
                    ...gtaVersionsForIntake.map((version) => ({
                      value: version.id,
                      label: formatGtaProgrammeVersionLabel(version),
                    })),
                  ]}
                  onChange={(gtaProgrammeVersionId) => {
                    setCreateForm((prev) => ({
                      ...prev,
                      gtaProgrammeVersionId,
                      teachingGroupId: "",
                      tutorName: "",
                      collegeDays: "",
                    }));
                  }}
                />
              </FormField>
              <FormField
                label="Teaching group"
                hint={
                  !createForm.gtaProgrammeVersionId
                    ? "Pin a GTA Programme Version first"
                    : compatibleGroups.length === 0
                      ? "No active teaching group delivers this version yet — you can add the apprentice unplaced, then create a group in Teaching Groups"
                      : "Tutor and college days come from this group. Groups are not filtered by intake."
                }
              >
                <Select
                  value={createForm.teachingGroupId}
                  disabled={!createForm.gtaProgrammeVersionId}
                  placeholder={
                    !createForm.gtaProgrammeVersionId
                      ? "Pin programme version first…"
                      : "Choose teaching group…"
                  }
                  options={[
                    {
                      value: "",
                      label: !createForm.gtaProgrammeVersionId
                        ? "Pin programme version first…"
                        : compatibleGroups.length === 0
                          ? "No compatible teaching group yet"
                          : "Choose teaching group…",
                    },
                    ...compatibleGroups.map((g) => {
                      const n = currentMemberCount(store.enrolments ?? [], g.id);
                      return {
                        value: g.id,
                        label: formatTeachingGroupOptionLabel(g, n),
                      };
                    }),
                  ]}
                  onChange={(teachingGroupId) => {
                    const group = (store.teachingGroups ?? []).find(
                      (g) => g.id === teachingGroupId,
                    );
                    setCreateForm((prev) => ({
                      ...prev,
                      teachingGroupId,
                      tutorName: group?.tutorName ?? "",
                      collegeDays: group?.collegeDays ?? "",
                    }));
                  }}
                />
              </FormField>
            </div>

            {selectedCohort || createForm.apprenticeshipStartDate ? (
              <div className={styles.placementFromCohort}>
                <p className={styles.placementFromCohortTitle}>
                  Dates belong to this apprentice
                </p>
                <dl className={styles.placementFromCohortGrid}>
                  <div>
                    <dt>Apprenticeship start</dt>
                    <dd>
                      {formatDate(createForm.apprenticeshipStartDate)}
                    </dd>
                  </div>
                  <div>
                    <dt>Planned end</dt>
                    <dd>{formatDate(createForm.apprenticeshipEndDate)}</dd>
                  </div>
                  <div>
                    <dt>Intake start</dt>
                    <dd>
                      {selectedCohort
                        ? formatDate(selectedCohort.startDate)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tutor / college days</dt>
                    <dd>
                      {createForm.tutorName
                        ? `${createForm.tutorName}${
                            createForm.collegeDays
                              ? ` · ${formatCollegeDaysShort(createForm.collegeDays)}`
                              : ""
                          }`
                        : "From teaching group"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}
            {overCapacityRetry ? (
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy}
                  onClick={() => void overCapacityRetry()}
                >
                  Add over capacity
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy}
                  onClick={() => {
                    setOverCapacityRetry(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => void submitCreate()}
              >
                {busy ? "Adding…" : "Add apprentice"}
              </button>
            </div>
          </section>
        </div>
      </ApprenticePageShell>
    );
  }

  if (active) {
    const gaps = missingPersonalFields(active).filter((field) =>
      ["full name", "date of birth", "email"].includes(field),
    );

    return (
      <ApprenticePageShell
        eyebrow="Administration · Apprentice Intake"
        title={active.displayName}
        description={`${active.apprenticeReference} · finish personal details — pack documents are managed on Apprentices`}
        actions={
          <div className={styles.toolbarActions}>
            <Link
              href={`/apprentices/${active.id}?from=administration`}
              className={styles.secondaryBtn}
            >
              Open pack
            </Link>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setSuccess(
                  `Draft saved for ${active.displayName} — pick it back up any time.`,
                );
                closeEditor();
              }}
            >
              Save and close
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => completeIntake(active)}
            >
              Mark ready
            </button>
          </div>
        }
      >
        <div className={styles.stack}>
          {error ? <p className={styles.error}>{error}</p> : null}
          {gaps.length > 0 ? (
            <p className={styles.linkedApprenticeNote}>
              Still needed to mark ready: {gaps.join(", ")}.
            </p>
          ) : (
            <p className={styles.linkedApprenticeNote}>
              Personal details are complete. Mark ready when you&apos;re done.
              Programme documents live in their{" "}
              <Link href={`/apprentices/${active.id}?from=administration`}>
                full apprentice pack
              </Link>
              .
            </p>
          )}

          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>Personal details</h2>
            </div>
            <div className={styles.employerDetailGrid}>
              <IntakeInlineField
                label="Full name"
                value={active.displayName}
                required
                onCommit={(next) =>
                  updateApprentice(active.id, { displayName: next })
                }
              />
              <IntakeInlineField
                label="Apprentice reference"
                value={active.apprenticeReference}
                onCommit={(next) =>
                  updateApprentice(active.id, { apprenticeReference: next })
                }
              />
              <IntakeInlineField
                label="Date of birth"
                value={active.dateOfBirth}
                type="date"
                required
                onCommit={(next) =>
                  updateApprentice(active.id, { dateOfBirth: next })
                }
              />
              <IntakeInlineField
                label="ULN"
                value={active.uln}
                placeholder="Can be added later"
                onCommit={(next) => updateApprentice(active.id, { uln: next })}
              />
              <IntakeInlineField
                label="Email"
                value={active.email}
                type="email"
                required
                onCommit={(next) => updateApprentice(active.id, { email: next })}
              />
              <IntakeInlineField
                label="Phone"
                value={active.phone}
                type="tel"
                onCommit={(next) => updateApprentice(active.id, { phone: next })}
              />
              <IntakeInlineField
                label="Address line 1"
                value={active.addressLine1}
                onCommit={(next) =>
                  updateApprentice(active.id, { addressLine1: next })
                }
              />
              <IntakeInlineField
                label="Address line 2"
                value={active.addressLine2}
                onCommit={(next) =>
                  updateApprentice(active.id, { addressLine2: next })
                }
              />
              <IntakeInlineField
                label="Town / city"
                value={active.town}
                onCommit={(next) => updateApprentice(active.id, { town: next })}
              />
              <IntakeInlineField
                label="Postcode"
                value={active.postcode}
                onCommit={(next) =>
                  updateApprentice(active.id, { postcode: next })
                }
              />
              <IntakeInlineField
                label="Emergency contact"
                value={active.emergencyContactName}
                onCommit={(next) =>
                  updateApprentice(active.id, { emergencyContactName: next })
                }
              />
              <IntakeInlineField
                label="Emergency phone"
                value={active.emergencyContactPhone}
                type="tel"
                onCommit={(next) =>
                  updateApprentice(active.id, { emergencyContactPhone: next })
                }
              />
              <IntakeInlineField
                label="Relationship"
                value={active.emergencyContactRelationship}
                placeholder="e.g. Mother, guardian…"
                onCommit={(next) =>
                  updateApprentice(active.id, {
                    emergencyContactRelationship: next,
                  })
                }
              />
              <IntakeInlineField
                label="Learning support needs"
                value={active.supportNotes}
                wide
                multiline
                onCommit={(next) =>
                  updateApprentice(active.id, { supportNotes: next })
                }
              />
              <IntakeInlineField
                label="Notes"
                value={active.notes}
                wide
                multiline
                placeholder="What's still to chase…"
                onCommit={(next) => updateApprentice(active.id, { notes: next })}
              />
            </div>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={closeEditor}
              >
                Back to queue
              </button>
              <Link
                href={`/apprentices/${active.id}?from=administration`}
                className={styles.secondaryBtn}
              >
                Open pack
              </Link>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => completeIntake(active)}
              >
                Mark ready
              </button>
            </div>
          </section>
        </div>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      eyebrow="Administration"
      title="Apprentice Intake"
      description="Add apprentices with account and placement in one go. Finish any remaining personal details afterwards. Staff onboarding sits on Management."
      actions={
        <button type="button" className={styles.primaryBtn} onClick={startNew}>
          Start new apprentice
        </button>
      }
    >
      <div className={styles.stack}>
        {success ? <p className={styles.success}>{success}</p> : null}

        {lastReadyId ? (
          <p className={styles.linkedApprenticeNote}>
            <Link href={`/apprentices/${lastReadyId}?from=administration`}>
              Open apprentice pack
            </Link>
          </p>
        ) : null}

        {readyAwaiting.length > 0 ? (
          <section className={styles.formGroup}>
            <div className={styles.formGroupHead}>
              <h2 className={styles.formGroupTitle}>On the system</h2>
              <span className={styles.formGroupBadge}>
                {readyAwaiting.length} ready
              </span>
            </div>
            <p className={styles.formGroupMeta}>
              Personal intake signed off. Open the full apprentice pack for
              programme documents.
            </p>
            <ul className={styles.linkedApprenticeList}>
              {readyAwaiting.map((row) => (
                <li key={row.id}>
                  <div className={styles.linkedApprenticeRow}>
                    <div className={styles.linkedApprenticeMain}>
                      <strong>{row.displayName}</strong>
                      <span>{row.apprenticeReference}</span>
                    </div>
                    <div className={styles.linkedApprenticeAside}>
                      <Link
                        href={`/apprentices/${row.id}?from=administration`}
                        className={styles.secondaryBtn}
                      >
                        Open pack
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {queue.length === 0 ? (
          <p className={styles.empty}>
            No intakes in progress. Start a new apprentice when you want to get
            ahead on someone.
          </p>
        ) : (
          <div className={styles.employerList}>
            {queue.map((row) => {
              const gaps = missingPersonalFields(row).filter((field) =>
                ["full name", "date of birth", "email"].includes(field),
              );
              return (
                <article
                  key={row.id}
                  className={styles.employerCard}
                  data-tone="amber"
                  data-open="false"
                  role="button"
                  tabIndex={0}
                  aria-label={`Continue intake for ${row.displayName}`}
                  onClick={() => resume(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      resume(row);
                    }
                  }}
                >
                  <div className={styles.employerCardHeader}>
                    <div className={styles.employerCardMain}>
                      <strong className={styles.employerName}>
                        {row.displayName}
                      </strong>
                      <span>
                        {row.apprenticeReference}
                        {row.dateOfBirth
                          ? ` · DOB ${formatDate(row.dateOfBirth)}`
                          : ""}
                        {row.town ? ` · ${row.town}` : ""}
                      </span>
                      <span>
                        {gaps.length > 0
                          ? `Still needed: ${gaps.join(", ")}`
                          : "Personal details complete — ready to sign off"}
                      </span>
                    </div>
                    <div className={styles.employerPillColumn}>
                      <span
                        className={styles.intakeStatusPill}
                        data-status={
                          gaps.length === 0 ? "ready" : "in_progress"
                        }
                      >
                        {gaps.length === 0
                          ? "Ready to sign off"
                          : "In progress"}
                      </span>
                      <Link
                        href={`/apprentices/${row.id}?from=administration`}
                        className={styles.employerApprenticePill}
                        data-has="true"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        Open pack
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ApprenticePageShell>
  );
}

/** Signed-in intake routes show the layout preview. Saving stays off until layout approval. */
export function AdminApprenticeIntakeScreen() {
  return <ApprenticesVisualPreview />;
}
