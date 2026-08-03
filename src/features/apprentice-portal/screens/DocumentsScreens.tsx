"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { StepBackButton } from "../components/StepBackButton";
import { AlsLlddAssessmentPanel } from "../components/AlsLlddAssessmentPanel";
import { EnrolmentFormAf11Panel } from "../components/EnrolmentFormAf11Panel";
import { InterviewFormAf12Panel } from "../components/InterviewFormAf12Panel";
import { PlrReportPanel } from "../components/PlrReportPanel";
import { RpleAssessmentPanel } from "../components/RpleAssessmentPanel";
import { TrainingPlanAgreementPanel } from "../components/TrainingPlanAgreementPanel";
import {
  getAf11EnrolmentSnapshot,
  subscribeAf11EnrolmentStore,
} from "../domain/enrolment-form-af11";
import {
  getAf12InterviewSnapshot,
  subscribeAf12InterviewStore,
} from "../domain/interview-form-af12";
import {
  getAlsLlddSnapshot,
  subscribeAlsLlddStore,
} from "../domain/als-lldd-form";
import { getPlrSnapshot, subscribePlrStore } from "../domain/plr-store";
import { getRpleSnapshot, subscribeRpleStore } from "../domain/rple-form";
import { ALEX_PROFILE } from "../domain/mock-apprentice";
import {
  ADM14_FORM_CODE,
  ADM14_FORM_TITLE,
  documentsBasePath,
  documentsItemsForAudience,
  documentsRowTone,
  documentsSectionsForAudience,
  documentsStatusTone,
  resolveDocumentsItem,
  resolveDocumentsSection,
  type DocumentsAudience,
} from "../domain/documents";
import styles from "./apprentice-pages.module.css";

function useDocumentsFormsRefresh() {
  useSyncExternalStore(
    (onChange) => {
      const unsub1 = subscribeAf11EnrolmentStore(onChange);
      const unsub2 = subscribeAf12InterviewStore(onChange);
      const unsub3 = subscribeRpleStore(onChange);
      const unsub4 = subscribePlrStore(onChange);
      const unsub5 = subscribeAlsLlddStore(onChange);
      return () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
      };
    },
    () =>
      `${getAf11EnrolmentSnapshot()}::${getAf12InterviewSnapshot()}::${getRpleSnapshot()}::${getPlrSnapshot()}::${getAlsLlddSnapshot()}`,
    () => "server",
  );
}

function audienceMeta(audience: DocumentsAudience) {
  if (audience === "employer") {
    return {
      eyebrow: "Employer workspace",
      hubDescription:
        "Apprenticeship evidence pack for your apprentice — complete and sign the employer documents in each section.",
    };
  }
  return {
    eyebrow: "Apprentice portal",
    hubDescription:
      "Your apprenticeship evidence pack — open each section to view, complete, or sign the documents that apply to you.",
  };
}

export function DocumentsHubScreen({
  audience,
}: {
  audience: DocumentsAudience;
}) {
  useDocumentsFormsRefresh();
  const meta = audienceMeta(audience);
  const sections = documentsSectionsForAudience(audience);
  const totalItems = sections.reduce((n, s) => n + s.itemCount, 0);
  const totalComplete = sections.reduce((n, s) => n + s.completeCount, 0);
  const totalAction = sections.reduce((n, s) => n + s.actionNeededCount, 0);

  return (
    <ApprenticePageShell
      eyebrow={meta.eyebrow}
      title="Documents"
      description={meta.hubDescription}
    >
      <div className={styles.stack}>
        <p className={styles.metaBlock}>
          {ADM14_FORM_CODE} · {ADM14_FORM_TITLE}
        </p>

        <div className={styles.grid}>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>Sections</p>
            <p className={styles.glanceValue}>{sections.length}</p>
            <p className={styles.glanceHint}>ADM14 booklet sections for you</p>
          </div>
          <div className={styles.glance} data-tone="green">
            <p className={styles.glanceLabel}>Complete</p>
            <p className={styles.glanceValue}>
              {totalComplete}/{totalItems}
            </p>
            <p className={styles.glanceHint}>Documents marked complete</p>
          </div>
          <div
            className={styles.glance}
            data-tone={totalAction > 0 ? "amber" : "green"}
          >
            <p className={styles.glanceLabel}>Needs attention</p>
            <p className={styles.glanceValue}>{totalAction}</p>
            <p className={styles.glanceHint}>
              In progress, awaiting sign-off, or form not wired yet
            </p>
          </div>
        </div>

        <section className={styles.section} aria-labelledby="docs-sections">
          <h2 id="docs-sections" className={styles.sectionTitle}>
            Evidence pack sections
          </h2>
          <ul className={styles.list}>
            {sections.map((section) => {
              const tone =
                section.actionNeededCount > 0
                  ? "amber"
                  : section.completeCount === section.itemCount
                    ? "green"
                    : "navy";
              return (
                <li key={section.key}>
                  <Link
                    href={section.href}
                    className={styles.rowLink}
                    data-tone={tone}
                  >
                    <div className={styles.rowMain}>
                      <strong>
                        {section.bookletSection} · {section.title}
                      </strong>
                      <span>{section.summary}</span>
                      <span>
                        {section.completeCount} of {section.itemCount} complete
                        {section.actionNeededCount > 0
                          ? ` · ${section.actionNeededCount} need attention`
                          : ""}
                      </span>
                    </div>
                    <div className={styles.rowEnd}>
                      <ApprenticeStatusChip
                        tone={
                          section.actionNeededCount > 0 ? "amber" : "green"
                        }
                      >
                        {section.actionNeededCount > 0
                          ? `${section.actionNeededCount} open`
                          : "Up to date"}
                      </ApprenticeStatusChip>
                      <span className={styles.linkish}>Open section →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </ApprenticePageShell>
  );
}

export function DocumentsSectionScreen({
  audience,
  sectionKey,
}: {
  audience: DocumentsAudience;
  sectionKey: string;
}) {
  useDocumentsFormsRefresh();
  const meta = audienceMeta(audience);
  const section = resolveDocumentsSection(sectionKey);
  const hubHref = documentsBasePath(audience);
  const items = documentsItemsForAudience(audience, sectionKey);

  if (!section || items.length === 0) {
    return (
      <ApprenticePageShell
        eyebrow={meta.eyebrow}
        title="Section not found"
        description="This ADM14 section is not available for your Documents portal."
        actions={<StepBackButton parentHref={hubHref} label="Documents" />}
      >
        <p className={styles.metaBlock}>
          Check the Documents hub for sections that apply to you.
        </p>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      eyebrow={meta.eyebrow}
      title={`${section.bookletSection} · ${section.title}`}
      description={section.summary}
      actions={<StepBackButton parentHref={hubHref} label="Documents" />}
    >
      <div className={styles.stack}>
        <p className={styles.crumb}>
          <Link href={hubHref}>Documents</Link>
          <span aria-hidden>/</span>
          <span>
            {section.bookletSection} · {section.title}
          </span>
        </p>

        <ul className={styles.list}>
          {items.map((item) => {
            const tone = documentsRowTone(item.status);
            return (
              <li key={item.reference}>
                <Link
                  href={item.href}
                  className={styles.rowLink}
                  {...(tone ? { "data-tone": tone } : {})}
                >
                  <div className={styles.rowMain}>
                    <strong>
                      {item.reference} · {item.title}
                    </strong>
                    <span>{item.applicability}</span>
                    <span>
                      {item.requirementKind === "mandatory"
                        ? "Mandatory"
                        : "Conditional"}
                      {item.isRecurring ? " · Recurring" : ""}
                      {item.endOfProgramme ? " · End of programme" : ""}
                      {item.formReady ? "" : " · Real form not wired yet"}
                    </span>
                  </div>
                  <div className={styles.rowEnd}>
                    <ApprenticeStatusChip tone={documentsStatusTone(item.status)}>
                      {item.statusLabel}
                    </ApprenticeStatusChip>
                    <span className={styles.linkish}>
                      {item.formReady ? "Open →" : "View →"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </ApprenticePageShell>
  );
}

export function DocumentsItemScreen({
  audience,
  sectionKey,
  reference,
}: {
  audience: DocumentsAudience;
  sectionKey: string;
  reference: string;
}) {
  useDocumentsFormsRefresh();
  const meta = audienceMeta(audience);
  const item = resolveDocumentsItem(audience, sectionKey, reference);
  const hubHref = documentsBasePath(audience);
  const sectionHref = `${hubHref}/${sectionKey}`;
  const section = resolveDocumentsSection(sectionKey);

  if (!item || !section) {
    return (
      <ApprenticePageShell
        eyebrow={meta.eyebrow}
        title="Document not found"
        description="This document is not available on your Documents portal."
        actions={<StepBackButton parentHref={hubHref} label="Documents" />}
      >
        <p className={styles.metaBlock}>
          Return to Documents and open a section that applies to you.
        </p>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      eyebrow={meta.eyebrow}
      title={`${item.reference} · ${item.title}`}
      description={item.applicability}
      actions={
        <StepBackButton
          parentHref={sectionHref}
          label={section.bookletSection}
        />
      }
    >
      <div className={styles.stack}>
        <p className={styles.crumb}>
          <Link href={hubHref}>Documents</Link>
          <span aria-hidden>/</span>
          <Link href={sectionHref}>
            {section.bookletSection} · {section.title}
          </Link>
          <span aria-hidden>/</span>
          <span>{item.reference}</span>
        </p>

        <div className={styles.grid}>
          <div
            className={styles.glance}
            data-tone={documentsStatusTone(item.status)}
          >
            <p className={styles.glanceLabel}>Status</p>
            <p className={styles.glanceValueSmall}>{item.statusLabel}</p>
            <p className={styles.glanceHint}>
              {item.requirementKind === "mandatory"
                ? "Mandatory"
                : "Conditional"}
              {item.isRecurring ? " · Recurring" : ""}
            </p>
          </div>
          <div className={styles.glance} data-tone="navy">
            <p className={styles.glanceLabel}>ADM14</p>
            <p className={styles.glanceValueSmall}>{item.reference}</p>
            <p className={styles.glanceHint}>
              {section.bookletSection} · {section.title}
            </p>
          </div>
        </div>

        {item.reference === "1.2" ? (
          <EnrolmentFormAf11Panel />
        ) : item.reference === "1.3" ? (
          <InterviewFormAf12Panel />
        ) : item.reference === "1.5" ? (
          <RpleAssessmentPanel />
        ) : item.reference === "1.6" ? (
          <PlrReportPanel />
        ) : item.reference === "1.7" ? (
          <AlsLlddAssessmentPanel />
        ) : item.reference === "4.1" ? (
          <TrainingPlanAgreementPanel
            audience={audience === "employer" ? "employer" : "apprentice"}
            apprenticeName={ALEX_PROFILE.displayName}
            employerName={ALEX_PROFILE.employerName}
            employerContact={ALEX_PROFILE.employerContact}
            mentorName={ALEX_PROFILE.mentorName}
          />
        ) : (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Document workspace</h2>
            <div className={styles.otjSummaryCard} data-tone="navy">
              <p className={styles.glanceLabel}>Awaiting real form</p>
              <p className={styles.metaBlock}>
                This ADM14 row is ready in the pack structure. Paste or upload
                the official GTA document for{" "}
                <strong>
                  {item.reference} · {item.title}
                </strong>{" "}
                and it will be wired into this page (fill, sign, and sync rules
                included).
              </p>
              <p className={styles.glanceHint}>
                Until then, status is tracked on the section list only.
              </p>
            </div>
          </section>
        )}
      </div>
    </ApprenticePageShell>
  );
}
