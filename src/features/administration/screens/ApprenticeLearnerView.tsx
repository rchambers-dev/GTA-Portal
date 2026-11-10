"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import type { ApprenticeProgrammePage } from "../domain/apprentice-programme";
import { assignApprenticeTutorAction } from "./apprentice-tutor-actions";
import { ApprenticeProgrammePanel } from "./ApprenticeProgrammePanel";
import type { ApprenticeLearnerPage } from "../domain/apprentice-tutor-repository";
import { employmentSiteLabel, type CurrentApprenticeEmployment } from "../domain/employer-record";
import {
  LEARNER_SECTIONS,
  apprenticeLearnerPath,
  displayRequestedId,
  formatTutorDate,
  formatTutorOption,
  learnerSectionFromQuery,
  learnerSectionHref,
  type ApprenticeLearnerRecord,
  type TutorAssignment,
} from "../domain/apprentice-tutor";
import styles from "./admin-pages.module.css";

export function ApprenticeLearnerView({
  workspace,
  canAssign,
  canManageProgramme,
  page,
  programme,
}: {
  workspace: "administration" | "management";
  canAssign: boolean;
  canManageProgramme: boolean;
  page: ApprenticeLearnerPage;
  programme: ApprenticeProgrammePage | null;
}) {
  const pathname = usePathname() ?? apprenticeLearnerPath(workspace, page.requestedId);
  const searchParams = useSearchParams();
  const section = learnerSectionFromQuery(searchParams.get("tab"));
  const basePath = pathname.split("?")[0] || apprenticeLearnerPath(workspace, page.requestedId);
  const listHref = `/${workspace}/onboarding/apprentice`;
  const apprentice = page.apprentice;

  return (
    <ApprenticePageShell
      eyebrow="Onboarding"
      title={apprentice?.name ?? "Apprentice"}
      description={
        apprentice
          ? `${apprentice.gtaId} · ${apprentice.programmeLabel} · ${apprentice.statusLabel}`
          : page.loadError ??
            `No apprentice has the GTA ID ${displayRequestedId(page.requestedId)}.`
      }
      actions={
        <Link className={styles.secondaryBtn} href={listHref}>
          All apprentices
        </Link>
      }
    >
      <div className={styles.stack} data-learner-page="live">
        {page.loadError ? (
          <p className={styles.error} role="alert">
            {page.loadError}
          </p>
        ) : null}

        {apprentice ? (
          <>
            <nav className={styles.tabRow} aria-label="Learner sections">
              {LEARNER_SECTIONS.map((item) => {
                const active = item.id === section;
                return (
                  <Link
                    key={item.id}
                    href={learnerSectionHref(basePath, item.id)}
                    className={active ? styles.tabActive : styles.tab}
                    aria-current={active ? "page" : undefined}
                    data-learner-tab={item.id}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {section === "tutor" ? (
              <TutorPanel
                gtaId={apprentice.gtaId}
                canAssign={canAssign}
                currentTutor={page.currentTutor}
                tutorHistory={page.tutorHistory}
                tutorOptions={page.tutorOptions}
              />
            ) : section === "programme" ? (
              programme ? (
                <ApprenticeProgrammePanel
                  canManage={canManageProgramme}
                  apprentice={apprentice}
                  programme={programme}
                />
              ) : (
                <p className={styles.error} role="alert">
                  Programme details could not be loaded.
                </p>
              )
            ) : (
              <OverviewPanel apprentice={apprentice} employment={page.currentEmployment} />
            )}
          </>
        ) : (
          <p className={styles.empty} role="status">
            {page.loadError
              ? "This apprentice could not be opened."
              : `No apprentice has the GTA ID ${displayRequestedId(page.requestedId)}.`}
          </p>
        )}
      </div>
    </ApprenticePageShell>
  );
}

function OverviewPanel({
  apprentice,
  employment,
}: {
  apprentice: ApprenticeLearnerRecord;
  employment: CurrentApprenticeEmployment | null;
}) {
  return (
    <section className={styles.learnerCard} aria-labelledby="learner-overview-heading" data-learner-section="overview">
      <h2 id="learner-overview-heading" className={styles.formGroupTitle}>
        Details
      </h2>
      <dl className={styles.learnerFacts}>
        <dt>Name</dt>
        <dd>{apprentice.name}</dd>
        <dt>GTA ID</dt>
        <dd className={styles.assignedId} data-learner-gta-id={apprentice.gtaId}>
          {apprentice.gtaId}
        </dd>
        <dt>Status</dt>
        <dd data-learner-status={apprentice.statusLabel}>{apprentice.statusLabel}</dd>
        <dt>Employer</dt>
        <dd data-learner-employer={employment?.companyName ?? ""}>
          {employment?.companyName ?? "No current employer"}
        </dd>
        {employment ? (
          <>
            <dt>Site</dt>
            <dd data-learner-site={employment.postcode}>{employmentSiteLabel(employment)}</dd>
            <dt>Manager</dt>
            <dd data-learner-manager={employment.managerName}>{employment.managerName}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function TutorPanel({
  gtaId,
  canAssign,
  currentTutor,
  tutorHistory,
  tutorOptions,
}: {
  gtaId: string;
  canAssign: boolean;
  currentTutor: TutorAssignment | null;
  tutorHistory: TutorAssignment[];
  tutorOptions: ApprenticeLearnerPage["tutorOptions"];
}) {
  return (
    <div className={styles.stack} data-learner-section="tutor">
      <section className={styles.learnerCard} aria-labelledby="current-tutor-heading">
        <h2 id="current-tutor-heading" className={styles.formGroupTitle}>
          Current tutor
        </h2>
        {currentTutor ? (
          <TutorSummary assignment={currentTutor} current />
        ) : (
          <p className={styles.empty} role="status">
            No tutor is assigned.
          </p>
        )}
        {canAssign ? (
          <TutorAssignForm gtaId={gtaId} currentTutor={currentTutor} tutorOptions={tutorOptions} />
        ) : (
          <p className={styles.formGroupMeta} role="status">
            You can view the tutor. Only Administrator and Management can assign or change one.
          </p>
        )}
      </section>
      <section className={styles.learnerCard} aria-labelledby="tutor-history-heading">
        <h2 id="tutor-history-heading" className={styles.formGroupTitle}>
          Previous tutors
        </h2>
        {tutorHistory.length === 0 ? (
          <p className={styles.empty} role="status">
            No previous tutors.
          </p>
        ) : (
          <ul className={styles.pillList} data-tutor-history="live">
            {tutorHistory.map((assignment) => (
              <li key={assignment.id}>
                <TutorSummary assignment={assignment} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TutorSummary({
  assignment,
  current = false,
}: {
  assignment: TutorAssignment;
  current?: boolean;
}) {
  return (
    <div
      className={`${styles.pillRow} ${styles.apprenticeRow}`}
      data-current-tutor={current ? assignment.tutorId : undefined}
    >
      <p className={styles.pillName}>{assignment.displayName}</p>
      <p className={styles.pillMeta}>
        {assignment.email && assignment.email !== assignment.displayName ? (
          <span>{assignment.email}</span>
        ) : null}
        <span>Started {formatTutorDate(assignment.startDate)}</span>
        {assignment.endDate ? <span>Ended {formatTutorDate(assignment.endDate)}</span> : null}
      </p>
    </div>
  );
}

function TutorAssignForm({
  gtaId,
  currentTutor,
  tutorOptions,
}: {
  gtaId: string;
  currentTutor: TutorAssignment | null;
  tutorOptions: ApprenticeLearnerPage["tutorOptions"];
}) {
  const router = useRouter();
  const [tutorId, setTutorId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const selectable = tutorOptions.some((tutor) => tutor.id !== currentTutor?.tutorId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (!tutorId) {
      setFormError("Choose a tutor.");
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      const result = await assignApprenticeTutorAction({ gtaId, tutorId });
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      setTutorId("");
      setSaved(true);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The tutor could not be saved.");
    } finally {
      setPending(false);
    }
  }

  if (tutorOptions.length === 0) {
    return (
      <p className={styles.empty} role="status">
        No tutors are available to assign.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate data-tutor-assign="live">
      <div className={styles.learnerField} data-entry-field="tutorId">
        <span id="tutor-id-label">{currentTutor ? "Change tutor" : "Assign tutor"}</span>
        <Select
          aria-label={currentTutor ? "Change tutor" : "Assign tutor"}
          value={tutorId}
          disabled={pending || !selectable}
          invalid={Boolean(formError)}
          placeholder="Choose a tutor"
          options={tutorOptions.map((tutor) => ({
            value: tutor.id,
            label: formatTutorOption(tutor),
            disabled: tutor.id === currentTutor?.tutorId,
          }))}
          onChange={setTutorId}
        />
      </div>
      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      {saved ? (
        <p className={styles.success} role="status">
          Tutor saved.
        </p>
      ) : null}
      <div className={styles.learnerActions}>
        <button type="submit" className={styles.primaryBtn} disabled={pending || !selectable}>
          {pending ? "Saving…" : currentTutor ? "Change tutor" : "Assign tutor"}
        </button>
      </div>
    </form>
  );
}
