"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import adminStyles from "@/features/administration/screens/admin-pages.module.css";
import {
  PROGRAMME_APPRENTICESHIPS,
  displayApprenticeshipTitle,
  type ProgrammeApprenticeshipOption,
} from "../domain/programme-apprenticeships";
import {
  createProgrammeForOfficial,
  ensureApiPingSchedule,
  getApiPingSchedule,
  getProgrammeDefinitionServerSnapshot,
  getProgrammeDefinitionSnapshot,
  goBackToCatalogue,
  isApiPingDue,
  publishProgramme,
  publishProgrammeFormula,
  recordProgrammeActivity,
  replaceOfficialVersion,
  selectProgramme,
  setProgrammeActivityActor,
  subscribeProgrammeDefinition,
  updateProgrammeParameters,
  updateProgrammeSpine,
  updateProgrammeTitle,
} from "../domain/programme-definition-store";
import { labelSpineType } from "../domain/spine-builder";
import type {
  OfficialStandardVersion,
  ProgrammeActivityEntry,
  SpineItem,
} from "../domain/types";
import { RPL_FORMULA_OPTIONS } from "../domain/rpl-formulas";
import {
  hoursDeficitAgainstMinimum,
  hoursSurplusAgainstMinimum,
  isStructureLocked,
  summariseHours,
  validateProgrammeDefinition,
} from "../domain/validation";
import { SpineBuilderPanel } from "./SpineBuilderPanel";
import styles from "./programme-builder.module.css";
import { usePortalSession } from "@/shell/session/PortalSessionProvider";

function useProgrammeDefinition() {
  return useSyncExternalStore(
    subscribeProgrammeDefinition,
    getProgrammeDefinitionSnapshot,
    getProgrammeDefinitionServerSnapshot,
  );
}

function money(value: number | null | undefined): string {
  if (value == null) return "Not imported";
  return `£${value.toLocaleString("en-GB")}`;
}

function numOrDash(value: number | null | undefined, suffix = ""): string {
  if (value == null) return "Not imported";
  return `${value}${suffix}`;
}

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

function formatTimeUntil(iso: string | null, nowMs: number): string {
  if (!iso) return "not scheduled";
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return "not scheduled";
  const diff = target - nowMs;
  if (diff <= 0) return "due now";
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `in ${days}d ${hours}h ${pad(mins)}m ${pad(secs)}s`;
  if (hours > 0) return `in ${hours}h ${pad(mins)}m ${pad(secs)}s`;
  if (mins > 0) return `in ${mins}m ${pad(secs)}s`;
  return `in ${secs}s`;
}

function formatTimeAgo(iso: string | null, nowMs: number): string {
  if (!iso) return "never";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "never";
  const diff = nowMs - then;
  if (diff < 1000) return "just now";
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${hours}h ${pad(mins)}m ago`;
  if (hours > 0) return `${hours}h ${pad(mins)}m ${pad(secs)}s ago`;
  if (mins > 0) return `${mins}m ${pad(secs)}s ago`;
  return `${secs}s ago`;
}

function activityKindLabel(kind: ProgrammeActivityEntry["kind"]): string {
  switch (kind) {
    case "api_request":
      return "POST request";
    case "api_ok":
      return "POST response";
    case "api_error":
      return "POST failed";
    case "new_version":
      return "New version";
    case "official_cached":
      return "Official pack";
    case "draft_reopened":
      return "Draft";
    case "programme_created":
      return "Draft created";
    case "spine_saved":
      return "Spine edit";
    case "parameters_saved":
      return "Parameters";
    case "formula_published":
      return "Formula";
    case "spine_published":
      return "Published";
    case "title_saved":
      return "Title";
    default:
      return "Event";
  }
}

const IMPORT_ENDPOINT = "/api/management/programme-definition/import";

function ActivityLogItem({ entry }: { entry: ProgrammeActivityEntry }) {
  const [open, setOpen] = useState(false);
  const detailEntries = entry.detail
    ? Object.entries(entry.detail).filter(
        ([key]) =>
          key !== "method" &&
          key !== "endpoint" &&
          key !== "httpLine" &&
          key !== "coalesceKey",
      )
    : [];
  const httpLine =
    (entry.detail?.httpLine && String(entry.detail.httpLine)) ||
    (entry.detail?.method && entry.detail?.endpoint
      ? `${entry.detail.method} ${entry.detail.endpoint}`
      : null);

  return (
    <li className={styles.activityItem} data-kind={entry.kind}>
      <button
        type="button"
        className={styles.activityItemBtn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.activityKind}>
          {activityKindLabel(entry.kind)}
        </span>
        {httpLine ? (
          <code className={styles.activityHttp}>{httpLine}</code>
        ) : null}
        <span className={styles.activitySummary}>{entry.summary}</span>
        <span className={styles.activityMeta}>
          {formatSavedAt(entry.at)} · {entry.actor}
        </span>
      </button>
      {open && detailEntries.length > 0 ? (
        <dl className={styles.activityDetail}>
          {detailEntries.map(([key, value]) => (
            <div
              key={key}
              className={
                key === "changes" ? styles.activityDetailWide : undefined
              }
            >
              <dt>{key === "changes" ? "What changed" : key}</dt>
              <dd>
                {value == null
                  ? "—"
                  : key === "changes"
                    ? String(value)
                        .split("\n")
                        .map((line) => (
                          <span key={line} className={styles.changeLine}>
                            {line}
                          </span>
                        ))
                    : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

export function ProgrammeBuilderScreen() {
  const { session } = usePortalSession();
  const state = useProgrammeDefinition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedApprenticeship, setSelectedApprenticeship] =
    useState<ProgrammeApprenticeshipOption>(PROGRAMME_APPRENTICESHIPS[0]!);
  const [ksbFilter, setKsbFilter] = useState<
    "all" | "knowledge" | "skill" | "behaviour"
  >("all");
  const [titleDraft, setTitleDraft] = useState("");
  const [selectedDutyKsb, setSelectedDutyKsb] = useState<{
    dutyCode: string;
    ksbCode: string;
  } | null>(null);
  const [spineMode, setSpineMode] = useState<"view" | "builder">("view");
  const [expandedKsb, setExpandedKsb] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [enableApprenticeshipOpen, setEnableApprenticeshipOpen] =
    useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pingBusy, setPingBusy] = useState(false);

  useLayoutEffect(() => {
    setProgrammeActivityActor(session.account.name);
  }, [session.account.name]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const programme = state.programmes.find(
    (p) => p.id === state.selectedProgrammeId,
  );
  const official = programme
    ? state.officialVersions.find((v) => v.id === programme.standardVersionId) ||
      state.officialVersions.find(
        (v) =>
          v.standardCode === programme.standardCode &&
          v.externalVersion === programme.externalVersion,
      )
    : undefined;

  const structureLocked = programme ? isStructureLocked(programme) : false;
  const formulaLocked =
    structureLocked ||
    programme?.parameters?.formulaStatus === "published";

  useEffect(() => {
    if (structureLocked && spineMode === "builder") {
      setSpineMode("view");
    }
  }, [structureLocked, spineMode]);

  useEffect(() => {
    if (!official?.standardCode) return;
    ensureApiPingSchedule(official.standardCode);
  }, [official?.standardCode]);

  const runScheduledApiPing = useCallback(async () => {
    if (!official || pingBusy) return;
    const code = official.standardCode;
    if (!isApiPingDue(code)) return;
    const title = displayApprenticeshipTitle(code, official.title);

    setPingBusy(true);
    try {
      recordProgrammeActivity({
        kind: "api_request",
        summary: `Scheduled 6-hour ping: searching for updates to ${title} (${code})`,
        standardCode: code,
        detail: {
          method: "POST",
          endpoint: IMPORT_ENDPOINT,
          httpLine: `POST ${IMPORT_ENDPOINT}`,
          when: "Scheduled ping (every 6 hours)",
          searchingFor: title,
          occupationCode: official.occupationCode,
          standardCode: code,
          trigger: "scheduled_ping",
        },
      });

      const res = await fetch(IMPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupationCode: official.occupationCode,
          standardCode: code,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        source?: "database" | "skills_england";
        official?: OfficialStandardVersion;
        error?: string;
        message?: string;
      };

      if (!data.ok || !data.official) {
        recordProgrammeActivity({
          kind: "api_error",
          summary: `Scheduled ping failed for ${code}`,
          standardCode: code,
          detail: {
            method: "POST",
            endpoint: IMPORT_ENDPOINT,
            httpLine: `POST ${IMPORT_ENDPOINT} → ${res.status}`,
            status: res.status,
            error: data.error || "Unknown error",
            trigger: "scheduled_ping",
          },
        });
        return;
      }

      recordProgrammeActivity({
        kind: "api_ok",
        summary:
          data.source === "database"
            ? `Scheduled ping response: portal database (${data.official.standardCode} v${data.official.externalVersion})`
            : `Scheduled ping response: Skills England (${data.official.standardCode} v${data.official.externalVersion})`,
        standardCode: data.official.standardCode,
        externalVersion: data.official.externalVersion,
        detail: {
          method: "POST",
          endpoint: IMPORT_ENDPOINT,
          httpLine: `POST ${IMPORT_ENDPOINT} → ${res.status}`,
          httpStatus: res.status,
          source: data.source || null,
          trigger: "scheduled_ping",
          externalVersion: data.official.externalVersion,
          sourceHash: data.official.sourceHash,
          duties: data.official.duties.length,
          ksbs: data.official.ksbs.length,
        },
      });

      replaceOfficialVersion(data.official);
    } catch (err) {
      recordProgrammeActivity({
        kind: "api_error",
        summary: `Scheduled ping failed for ${official.standardCode}`,
        standardCode: official.standardCode,
        detail: {
          method: "POST",
          endpoint: IMPORT_ENDPOINT,
          httpLine: `POST ${IMPORT_ENDPOINT}`,
          error: err instanceof Error ? err.message : "Ping failed",
          trigger: "scheduled_ping",
        },
      });
    } finally {
      setPingBusy(false);
      setNowMs(Date.now());
    }
  }, [official, pingBusy]);

  useEffect(() => {
    if (!official?.standardCode) return;
    if (!isApiPingDue(official.standardCode)) return;
    void runScheduledApiPing();
  }, [official?.standardCode, nowMs, runScheduledApiPing]);

  const hours = programme ? summariseHours(programme) : null;
  const structuredOtj = hours?.structurePlannedOtjHours ?? 0;
  const hoursDeficit = official
    ? hoursDeficitAgainstMinimum(
        official.minimumComplianceHours,
        structuredOtj,
      )
    : null;
  const hoursSurplus = official
    ? hoursSurplusAgainstMinimum(
        official.minimumComplianceHours,
        structuredOtj,
      )
    : null;
  const issues =
    programme && official
      ? validateProgrammeDefinition(official, programme)
      : [];
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const filteredKsbs = useMemo(() => {
    if (!official) return [];
    return official.ksbs.filter(
      (k) => ksbFilter === "all" || k.type === ksbFilter,
    );
  }, [official, ksbFilter]);

  const apprenticeshipTitle = official
    ? displayApprenticeshipTitle(official.standardCode, official.title)
    : selectedApprenticeship.title;

  const savedDraftForSelected = state.programmes.find(
    (p) => p.standardCode === selectedApprenticeship.standardCode,
  );

  async function importSelected() {
    setBusy(true);
    setMessage(null);
    try {
      const localExisting = state.programmes.find(
        (p) => p.standardCode === selectedApprenticeship.standardCode,
      );
      const localOfficial = localExisting
        ? state.officialVersions.find(
            (v) =>
              v.id === localExisting.standardVersionId ||
              (v.standardCode === localExisting.standardCode &&
                v.externalVersion === localExisting.externalVersion),
          )
        : state.officialVersions.find(
            (v) => v.standardCode === selectedApprenticeship.standardCode,
          );

      if (localExisting && localOfficial) {
        createProgrammeForOfficial(localOfficial);
        setTitleDraft(localExisting.programmeTitle);
        setSpineMode("view");
        setMessage(
          `Reopened ${selectedApprenticeship.title} (no API search — pack already held in the portal). Last saved ${formatSavedAt(localExisting.updatedAt)}.`,
        );
        return;
      }

      recordProgrammeActivity({
        kind: "api_request",
        summary: `Searching for official pack: ${selectedApprenticeship.title} (${selectedApprenticeship.standardCode}). Portal DB first, then Skills England if needed.`,
        standardCode: selectedApprenticeship.standardCode,
        detail: {
          method: "POST",
          endpoint: IMPORT_ENDPOINT,
          httpLine: `POST ${IMPORT_ENDPOINT}`,
          when: "Fired when Load is clicked and this apprenticeship is not already open in Programme Builder",
          searchingFor: selectedApprenticeship.title,
          occupationCode: selectedApprenticeship.occupationCode,
          standardCode: selectedApprenticeship.standardCode,
        },
      });

      const res = await fetch(IMPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupationCode: selectedApprenticeship.occupationCode,
          standardCode: selectedApprenticeship.standardCode,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        source?: "database" | "skills_england";
        official?: OfficialStandardVersion;
        error?: string;
        message?: string;
        apprenticeshipError?: string | null;
        receipt?: Record<string, string | number | boolean | null>;
      };

      if (!data.ok || !data.official) {
        recordProgrammeActivity({
          kind: "api_error",
          summary: `POST search failed for ${selectedApprenticeship.title}`,
          standardCode: selectedApprenticeship.standardCode,
          detail: {
            method: "POST",
            endpoint: IMPORT_ENDPOINT,
            httpLine: `POST ${IMPORT_ENDPOINT} → ${res.status}`,
            status: res.status,
            error: data.error || "Unknown error",
            source: data.source || null,
          },
        });
        throw new Error(
          data.error ||
            `${selectedApprenticeship.title} is not in the portal database and could not be imported from Skills England.`,
        );
      }

      recordProgrammeActivity({
        kind: "api_ok",
        summary:
          data.source === "database"
            ? `POST response: found in portal database (${data.official.standardCode} v${data.official.externalVersion})`
            : `POST response: fetched from Skills England (${data.official.standardCode} v${data.official.externalVersion})`,
        standardCode: data.official.standardCode,
        externalVersion: data.official.externalVersion,
        detail: {
          method: "POST",
          endpoint: IMPORT_ENDPOINT,
          httpLine: `POST ${IMPORT_ENDPOINT} → ${res.status}`,
          httpStatus: res.status,
          source: data.source || null,
          message: data.message || null,
          externalVersion: data.official.externalVersion,
          sourceHash: data.official.sourceHash,
          duties: data.official.duties.length,
          ksbs: data.official.ksbs.length,
          title: data.official.title,
          occupationCode: selectedApprenticeship.occupationCode,
          standardCode: data.official.standardCode,
          apprenticeshipError: data.apprenticeshipError || null,
        },
      });

      const stored = replaceOfficialVersion(data.official);
      const opened = createProgrammeForOfficial(stored);
      setTitleDraft(opened.programmeTitle);
      setSpineMode("view");

      const base =
        data.source === "database"
          ? `Loaded ${selectedApprenticeship.title} from the portal database and opened the GTA draft.`
          : `Imported ${selectedApprenticeship.title} from Skills England and saved. Opened GTA draft (no duplicate for this official version).`;
      setMessage(
        data.apprenticeshipError
          ? `${base} Product details incomplete: ${data.apprenticeshipError}`
          : base,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function onBack() {
    goBackToCatalogue();
    setSpineMode("view");
    setMessage("Draft kept — come back anytime via Load or Your programmes.");
  }

  function onSpineChange(next: SpineItem[]) {
    if (!programme || structureLocked) return;
    updateProgrammeSpine(programme.id, (p) => ({
      ...p,
      spineItems: next,
    }));
    setMessage(`Spine saved · ${formatSavedAt(new Date().toISOString())}`);
  }

  function onSaveTitle() {
    if (!programme) return;
    updateProgrammeTitle(programme.id, titleDraft || programme.programmeTitle);
    setMessage(`Title saved · ${formatSavedAt(new Date().toISOString())}`);
  }

  function onConfirmPublish() {
    if (!programme) return;
    const result = publishProgramme(programme.id);
    setPublishConfirmOpen(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(
      `Spine published · ${formatSavedAt(new Date().toISOString())}. You can still edit until learners enrol on this version.`,
    );
    setEnableApprenticeshipOpen(true);
  }

  function onPublishFormula() {
    if (!programme) return;
    const result = publishProgrammeFormula(programme.id);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(
      `RPL formula published · ${formatSavedAt(new Date().toISOString())}. Weights and K/S/B letters are now locked for this version.`,
    );
  }

  return (
    <ApprenticePageShell
      eyebrow="Management"
      title="Programme Builder"
      description="One GTA draft per Skills England version. Spines start empty and auto-save while you build. Publish when ready — structure locks only after learners enrol."
      actions={
        <div className={adminStyles.toolbarActions}>
          {programme && official ? (
            <button
              type="button"
              className={adminStyles.secondaryBtn}
              onClick={onBack}
            >
              Back
            </button>
          ) : null}
          <Link
            href="/management/course-builder"
            className={adminStyles.secondaryBtn}
          >
            Course Builder
          </Link>
          {!programme || !official ? (
            <button
              type="button"
              className={adminStyles.primaryBtn}
              disabled={busy || !selectedApprenticeship}
              onClick={() => importSelected()}
            >
              {busy
                ? "Working…"
                : savedDraftForSelected
                  ? `Open ${selectedApprenticeship.title}`
                  : `Load ${selectedApprenticeship.title}`}
            </button>
          ) : null}
        </div>
      }
    >
      {message ? (
        <p
          className={styles.banner}
          data-tone={
            /fail|error|could not|unavailable|not configured/i.test(message)
              ? "error"
              : "info"
          }
        >
          {message}
        </p>
      ) : null}

      {publishConfirmOpen && programme ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setPublishConfirmOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="publish-dialog-title">Publish this programme?</h2>
            <p>
              You are about to publish{" "}
              <strong>{programme.programmeTitle}</strong> (internal v
              {programme.internalVersion}).
            </p>
            <ul className={styles.modalList}>
              <li>
                Publishing marks this version as the live delivery spine for
                this official standard release.
              </li>
              <li>
                This cannot be casually undone. There is no “unpublish” that
                rewound history.
              </li>
              <li>
                Once any learner is enrolled on this version, the spine, hours,
                and KSB assignments lock permanently for that version.
              </li>
              <li>
                Until learners enrol, you can still edit the published spine
                (drafts and published versions both auto-save).
              </li>
            </ul>
            {errors.length > 0 ? (
              <p className={styles.lockNote}>
                There are still {errors.length} publish blocker
                {errors.length === 1 ? "" : "s"}. Fix them before publishing.
              </p>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={adminStyles.secondaryBtn}
                onClick={() => setPublishConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={adminStyles.primaryBtn}
                disabled={errors.length > 0}
                onClick={onConfirmPublish}
              >
                Yes, publish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {enableApprenticeshipOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setEnableApprenticeshipOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="enable-apprenticeship-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="enable-apprenticeship-title">
              Enable apprenticeship please
            </h2>
            <p>
              The spine is published. Enable this apprenticeship when you are
              ready for learners to use it.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={adminStyles.primaryBtn}
                onClick={() => setEnableApprenticeshipOpen(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!programme || !official ? (
        <div className={styles.startLayout}>
          <section className={styles.panel}>
            <h2>Choose an apprenticeship</h2>
            <p className={styles.meta}>
              Names are what staff use day to day. Skills England codes stay in
              the background for import and audit.
            </p>
            <div className={styles.apprenticeGrid}>
              {PROGRAMME_APPRENTICESHIPS.map((item) => {
                const active =
                  selectedApprenticeship.standardCode === item.standardCode;
                const draft = state.programmes.find(
                  (p) => p.standardCode === item.standardCode,
                );
                return (
                  <button
                    key={item.standardCode}
                    type="button"
                    className={styles.apprenticeCard}
                    data-active={active ? "true" : "false"}
                    onClick={() => setSelectedApprenticeship(item)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      Current pack v{item.currentVersion}
                      {draft
                        ? ` · Draft saved ${formatSavedAt(draft.updatedAt)}`
                        : " · Spine not built yet"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.panel}>
            <h2>
              {savedDraftForSelected
                ? `Open ${selectedApprenticeship.title}`
                : `Load ${selectedApprenticeship.title}`}
            </h2>
            <ol className={styles.steps}>
              <li>
                Reopening always uses the same draft for this official version —
                never a duplicate.
              </li>
              <li>
                If the official standard is not in the portal yet, import it
                once from Skills England and save it.
              </li>
              <li>
                New programmes start with an empty spine. Build it in Spine
                Builder — drafts auto-save so you can come back anytime.
              </li>
              <li>
                When ready, use Publish. Structure stays editable until
                learners are on that version.
              </li>
            </ol>

            {savedDraftForSelected ? (
              <p className={styles.meta}>
                Portal draft will reopen as-is (Internal v
                {savedDraftForSelected.internalVersion},{" "}
                {savedDraftForSelected.status}). No API search — pack already
                held.
              </p>
            ) : (
              <div className={styles.apiSearchNote}>
                <p>
                  <strong>Why Load matters:</strong> the first time you open{" "}
                  {selectedApprenticeship.title}, the portal pulls the official
                  apprenticeship pack so Jon has the right hours, duties, and
                  KSBs to build against. If it’s already open here, we don’t
                  fetch again — we just reopen your draft.
                </p>
              </div>
            )}

            <div className={styles.startActions}>
              <button
                type="button"
                className={adminStyles.primaryBtn}
                disabled={busy}
                onClick={() => importSelected()}
              >
                {busy
                  ? "Working…"
                  : savedDraftForSelected
                    ? `Open ${selectedApprenticeship.title}`
                    : `Load ${selectedApprenticeship.title}`}
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Official (locked)</h2>
              <ApprenticeStatusChip tone="green">Read-only</ApprenticeStatusChip>
            </div>
            <p className={styles.lead}>{apprenticeshipTitle}</p>
            <dl className={styles.kv}>
              <div>
                <dt>Skills England refs</dt>
                <dd>
                  {official.standardCode} · {official.occupationCode}
                </dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>v{official.externalVersion}</dd>
              </div>
              <div>
                <dt>Level / status</dt>
                <dd>
                  L{official.level} · {official.status}
                </dd>
              </div>
              <div>
                <dt>Typical duration</dt>
                <dd>{numOrDash(official.typicalDurationMonths, " months")}</dd>
              </div>
              <div>
                <dt>Assessment period</dt>
                <dd>{numOrDash(official.assessmentPeriodMonths, " months")}</dd>
              </div>
              <div>
                <dt>Min compliance hours</dt>
                <dd>{numOrDash(official.minimumComplianceHours)}</dd>
              </div>
              <div>
                <dt>Max funding</dt>
                <dd>{money(official.maximumFundingPounds)}</dd>
              </div>
              <div>
                <dt>LARS</dt>
                <dd>{numOrDash(official.larsCode)}</dd>
              </div>
              <div>
                <dt>Route</dt>
                <dd>{official.route || "—"}</dd>
              </div>
              <div>
                <dt>Duties / KSBs</dt>
                <dd>
                  {official.duties.length} duties · {official.ksbs.length} KSBs
                </dd>
              </div>
              <div>
                <dt>Imported</dt>
                <dd>{new Date(official.importedAt).toLocaleString("en-GB")}</dd>
              </div>
            </dl>
            {official.assessmentPlanUrl ? (
              <p className={styles.meta}>
                <a
                  href={official.assessmentPlanUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Assessment plan (Skills England)
                </a>
              </p>
            ) : null}

            <div className={styles.activityLog}>
              <div className={styles.activityLogHead}>
                <h3>History &amp; API log</h3>
                <span>
                  {(state.activityLog || []).filter(
                    (e) =>
                      !e.standardCode ||
                      e.standardCode === official.standardCode,
                  ).length || 0}{" "}
                  events
                </span>
              </div>
              <div className={styles.apiSearchNote}>
                <p>
                  <strong>Why we check every 6 hours:</strong> Skills England
                  can update an apprenticeship pack (version, hours, KSBs).
                  Automatic checks catch those changes without staff having to
                  remember to reload — and 6 hours keeps us well inside daily
                  request limits.
                </p>
              </div>
              {(() => {
                const ping = getApiPingSchedule(official.standardCode);
                return (
                  <div className={styles.apiPingStatus}>
                    <div>
                      <span>Last check</span>
                      <strong>
                        {ping.lastApiCallAt
                          ? `${formatSavedAt(ping.lastApiCallAt)} · ${formatTimeAgo(ping.lastApiCallAt, nowMs)}`
                          : "No check yet"}
                      </strong>
                    </div>
                    <div>
                      <span>Next check</span>
                      <strong>
                        {ping.nextPingAt
                          ? `${formatSavedAt(ping.nextPingAt)} · ${formatTimeUntil(ping.nextPingAt, nowMs)}`
                          : "Scheduling…"}
                        {pingBusy ? " · checking now…" : ""}
                      </strong>
                    </div>
                  </div>
                );
              })()}
              <p className={styles.activityLogHint}>
                History shows who changed what on this apprenticeship. Expand a
                row for the detail.
              </p>
              {(() => {
                const entries = (state.activityLog || []).filter(
                  (e) =>
                    !e.standardCode ||
                    e.standardCode === official.standardCode,
                );
                if (entries.length === 0) {
                  return (
                    <p className={styles.activityEmpty}>
                      No events yet. Load / refresh this apprenticeship or
                      edit the programme to start the log.
                    </p>
                  );
                }
                return (
                  <ul className={styles.activityList}>
                    {entries.slice(0, 40).map((entry) => (
                      <ActivityLogItem key={entry.id} entry={entry} />
                    ))}
                  </ul>
                );
              })()}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Programme</h2>
              <ApprenticeStatusChip tone={structureLocked ? "red" : "amber"}>
                {structureLocked ? "Structure locked" : programme.status}
              </ApprenticeStatusChip>
            </div>
            <label className={styles.titleEdit}>
              <span>Delivery title (wording)</span>
              <div className={styles.titleEditRow}>
                <input
                  type="text"
                  value={titleDraft || programme.programmeTitle}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onFocus={() =>
                    setTitleDraft((t) => t || programme.programmeTitle)
                  }
                />
                <button
                  type="button"
                  className={adminStyles.secondaryBtn}
                  onClick={onSaveTitle}
                >
                  Save title
                </button>
              </div>
            </label>
            <p className={styles.meta}>
              Internal v{programme.internalVersion} · Skills England v
              {programme.externalVersion || official.externalVersion} ·{" "}
              {hours?.blockCount ?? 0} blocks · {hours?.gatewayCount ?? 0}{" "}
              gateways · EPA {hours?.hasEpa ? "present" : "missing"}
            </p>
            <p className={styles.meta}>
              Auto-saved {formatSavedAt(programme.updatedAt)}. Back keeps this
              draft — Load will reopen it, not create another.
            </p>
            {structureLocked ? (
              <p className={styles.lockNote}>
                Learners are on this version (or it is archived/superseded).
                Spine, hours, and KSB assignments cannot change. Titles and
                wording can still be updated.
              </p>
            ) : programme.status === "published" ? (
              <p className={styles.meta}>
                Published — still editable because no learners are on this
                version yet. Structure will lock automatically once learners
                enrol.
              </p>
            ) : null}
            <div className={styles.paramsBox}>
              <h3>Delivery parameters</h3>
              <p className={styles.meta}>
                Jon-owned planning values. Expected OTJ is how long you think
                the course should be; structure hours below come from OTJ set on
                spine blocks. RPL weights snapshot onto this programme version
                for when learners join. Drafts auto-save.
              </p>
              <label className={styles.field}>
                <span>Expected course OTJ hours</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  disabled={structureLocked}
                  placeholder={
                    official.minimumComplianceHours != null
                      ? `e.g. ${official.minimumComplianceHours}`
                      : "e.g. 744"
                  }
                  value={programme.parameters?.expectedOtjHours ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateProgrammeParameters(programme.id, {
                      expectedOtjHours:
                        raw === "" ? null : Math.max(0, Number(raw) || 0),
                    });
                  }}
                />
              </label>

              <div className={styles.formulaBlock}>
                <div className={styles.formulaHead}>
                  <div className={styles.formulaHeadText}>
                    <p className={styles.formulaEyebrow}>RPL calculation type</p>
                    <p className={styles.formulaTitle}>
                      How prior learning reduces OTJ on this programme
                    </p>
                  </div>
                  <ApprenticeStatusChip
                    tone={
                      programme.parameters?.formulaStatus === "published"
                        ? "green"
                        : "amber"
                    }
                  >
                    {programme.parameters?.formulaStatus === "published"
                      ? "Published"
                      : "Draft"}
                  </ApprenticeStatusChip>
                </div>

                <div
                  className={styles.formulaTypeList}
                  role="radiogroup"
                  aria-label="RPL calculation type"
                >
                  {RPL_FORMULA_OPTIONS.map((opt) => {
                    const selected =
                      (programme.parameters?.formulaKey ??
                        "weighted_ksb_cap_v1") === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={styles.formulaTypeCard}
                        data-selected={selected ? "true" : "false"}
                        disabled={formulaLocked}
                        onClick={() => {
                          if (formulaLocked || selected) return;
                          updateProgrammeParameters(programme.id, {
                            formulaKey: opt.key,
                          });
                        }}
                      >
                        <span className={styles.formulaTypeCardTop}>
                          <span className={styles.formulaTypeRadio} aria-hidden>
                            <span />
                          </span>
                          <span className={styles.formulaTypeCardTitle}>
                            {opt.label}
                          </span>
                          {selected ? (
                            <span className={styles.formulaTypeSelectedTag}>
                              Selected
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.formulaTypeWhy}>{opt.why}</span>
                        {selected ? (
                          <span className={styles.formulaTypeMeta}>
                            <span>
                              <strong>Set on the programme</strong>
                              <span className={styles.formulaChipRow}>
                                {opt.programmeVariables.map((v) => (
                                  <span key={v} className={styles.formulaChip}>
                                    {v}
                                  </span>
                                ))}
                              </span>
                            </span>
                            <span>
                              <strong>Entered when a learner joins</strong>
                              <span className={styles.formulaChipRow}>
                                {opt.learnerVariables.map((v) => (
                                  <span key={v} className={styles.formulaChip}>
                                    {v}
                                  </span>
                                ))}
                              </span>
                            </span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.formulaMath} aria-label="Formula">
                  <div className={styles.formulaMathRow}>
                    <span className={styles.formulaMathKey}>Factor</span>
                    <code>
                      (
                      {[
                        programme.parameters?.includeAplK !== false
                          ? "K x weight_k"
                          : null,
                        programme.parameters?.includeAplS !== false
                          ? "S x weight_s"
                          : null,
                        programme.parameters?.includeAplB !== false
                          ? "B x weight_b"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" + ") || "—"}
                      ) / 100
                    </code>
                  </div>
                  <div className={styles.formulaMathRow}>
                    <span className={styles.formulaMathKey}>Deduction</span>
                    <code>
                      min(block OTJ x max, block OTJ x factor)
                    </code>
                  </div>
                </div>

                <p className={styles.formulaHint}>
                  Toggle a letter off if that part should not count for this
                  programme. Applied per block when a learner joins.
                </p>

                <div className={styles.ksbCards}>
                  {(
                    [
                      {
                        key: "includeAplK" as const,
                        weightKey: "aplWeightK" as const,
                        letter: "K",
                        name: "Knowledge",
                        defaultWeight: 0.3,
                      },
                      {
                        key: "includeAplS" as const,
                        weightKey: "aplWeightS" as const,
                        letter: "S",
                        name: "Skills",
                        defaultWeight: 0.5,
                      },
                      {
                        key: "includeAplB" as const,
                        weightKey: "aplWeightB" as const,
                        letter: "B",
                        name: "Behaviours",
                        defaultWeight: 0.2,
                      },
                    ] as const
                  ).map((item) => {
                    const on = programme.parameters?.[item.key] ?? true;
                    return (
                      <div
                        key={item.key}
                        className={styles.ksbCard}
                        data-on={on ? "true" : "false"}
                      >
                        <button
                          type="button"
                          className={styles.ksbCardToggle}
                          data-on={on ? "true" : "false"}
                          disabled={formulaLocked}
                          aria-pressed={on}
                          title={
                            on
                              ? `Remove ${item.name} from formula`
                              : `Add ${item.name} to formula`
                          }
                          onClick={() =>
                            updateProgrammeParameters(programme.id, {
                              [item.key]: !on,
                            })
                          }
                        >
                          <span className={styles.ksbLetter}>{item.letter}</span>
                          <span className={styles.ksbName}>{item.name}</span>
                          <span className={styles.ksbState}>
                            {on ? "On" : "Off"}
                          </span>
                        </button>
                        {on ? (
                          <label className={styles.ksbWeight}>
                            <span>Weight</span>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              disabled={formulaLocked}
                              value={
                                programme.parameters?.[item.weightKey] ??
                                item.defaultWeight
                              }
                              onChange={(e) =>
                                updateProgrammeParameters(programme.id, {
                                  [item.weightKey]: Math.max(
                                    0,
                                    Number(e.target.value) || 0,
                                  ),
                                })
                              }
                            />
                          </label>
                        ) : (
                          <p className={styles.ksbOffNote}>Not in formula</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className={styles.formulaFooter}>
                  <label className={styles.maxAplField}>
                    <span>Max APL of block OTJ</span>
                    <div className={styles.maxAplInput}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        disabled={formulaLocked}
                        value={Math.round(
                          (programme.parameters?.aplMaxFraction ?? 0.3) * 1000,
                        ) / 10}
                        onChange={(e) => {
                          const pct = Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0),
                          );
                          updateProgrammeParameters(programme.id, {
                            aplMaxFraction: pct / 100,
                          });
                        }}
                      />
                      <span aria-hidden="true">%</span>
                    </div>
                  </label>

                  {programme.parameters?.formulaStatus !== "published" &&
                  !structureLocked ? (
                    <button
                      type="button"
                      className={adminStyles.primaryBtn}
                      onClick={onPublishFormula}
                    >
                      Publish formula
                    </button>
                  ) : programme.parameters?.formulaStatus === "published" ? (
                    <p className={styles.formulaLockedNote}>
                      Locked for this version
                    </p>
                  ) : null}
                </div>
              </div>

              <label className={styles.field}>
                <span>RPL notes (optional)</span>
                <textarea
                  rows={2}
                  disabled={structureLocked}
                  placeholder="Local policy, evidence rules, etc."
                  value={programme.parameters?.rplNotes ?? ""}
                  onChange={(e) =>
                    updateProgrammeParameters(programme.id, {
                      rplNotes: e.target.value,
                    })
                  }
                />
              </label>
              {programme.parameters?.expectedOtjHours != null ? (
                <p className={styles.meta}>
                  Structured so far: {structuredOtj} /{" "}
                  {programme.parameters.expectedOtjHours} expected OTJ hrs
                  {programme.parameters.expectedOtjHours - structuredOtj > 0
                    ? ` · ${Math.round((programme.parameters.expectedOtjHours - structuredOtj) * 10) / 10} hrs still to allocate on the spine`
                    : structuredOtj > programme.parameters.expectedOtjHours
                      ? ` · ${Math.round((structuredOtj - programme.parameters.expectedOtjHours) * 10) / 10} hrs over Jon’s expected`
                      : " · spine matches Jon’s expected total"}
                </p>
              ) : null}
            </div>
            <div className={styles.hoursBox}>
              <div>
                <span>Target (min compliance)</span>
                <strong>
                  {numOrDash(official.minimumComplianceHours)} hrs
                </strong>
              </div>
              <div>
                <span>Structure planned OTJ</span>
                <strong>{structuredOtj} hrs</strong>
              </div>
              <div
                className={
                  hoursDeficit != null && hoursDeficit > 0
                    ? styles.hoursDeficit
                    : hoursSurplus != null && hoursSurplus > 0
                      ? styles.hoursSurplus
                      : undefined
                }
              >
                <span>Hours deficit vs minimum</span>
                <strong>
                  {hoursDeficit == null
                    ? "—"
                    : hoursDeficit > 0
                      ? `${hoursDeficit} hrs short`
                      : hoursSurplus != null && hoursSurplus > 0
                        ? `${hoursSurplus} hrs surplus`
                        : "On target"}
                </strong>
              </div>
            </div>
            <div className={styles.issues}>
              <p>
                <strong>{errors.length}</strong> publish blockers ·{" "}
                <strong>{warnings.length}</strong> warnings
              </p>
              <ul>
                {issues.slice(0, 12).map((issue) => (
                  <li
                    key={`${issue.code}-${issue.message}`}
                    data-severity={issue.severity}
                  >
                    {issue.message}
                  </li>
                ))}
                {issues.length > 12 ? (
                  <li>…and {issues.length - 12} more</li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.span2}`}>
            <div className={styles.panelHead}>
              <h2>Spine</h2>
              <div className={styles.spineActions}>
                {programme.status !== "published" && !structureLocked ? (
                  <button
                    type="button"
                    className={adminStyles.primaryBtn}
                    disabled={errors.length > 0}
                    title={
                      errors.length > 0
                        ? "Fix publish blockers before publishing"
                        : "Publish this programme version"
                    }
                    onClick={() => setPublishConfirmOpen(true)}
                  >
                    Publish
                  </button>
                ) : null}
                <button
                  type="button"
                  className={
                    spineMode === "builder"
                      ? adminStyles.primaryBtn
                      : adminStyles.secondaryBtn
                  }
                  disabled={structureLocked}
                  onClick={() =>
                    setSpineMode((m) => (m === "view" ? "builder" : "view"))
                  }
                  title={
                    structureLocked
                      ? "Structure is locked on this version"
                      : undefined
                  }
                >
                  {spineMode === "builder" ? "Done" : "Open Spine Builder"}
                </button>
              </div>
            </div>
            <p className={styles.meta}>
              Structure is GTA-owned. Official wording above stays locked.
              {structureLocked
                ? " Structure editing is locked while apprentices are enrolled."
                : spineMode === "builder"
                  ? " Drag structure pieces onto the canvas and drop KSBs onto blocks."
                  : " Open Spine Builder to edit sequence and assign KSBs."}
            </p>

            {spineMode === "builder" && !structureLocked ? (
              <SpineBuilderPanel
                items={programme.spineItems}
                ksbs={official.ksbs}
                hoursDeficit={hoursDeficit}
                minimumComplianceHours={official.minimumComplianceHours}
                structurePlannedOtjHours={structuredOtj}
                onChange={onSpineChange}
              />
            ) : programme.spineItems.length === 0 ? (
              <div className={styles.emptyDuties}>
                <p className={styles.meta}>
                  This spine is empty. Open Spine Builder to add blocks,
                  gateways, and EPA.
                </p>
              </div>
            ) : (
              <div className={styles.spineTableWrap}>
                <table className={styles.spineTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Weeks</th>
                      <th>OTJ hrs</th>
                      <th>KSBs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programme.spineItems
                      .slice()
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((item) => (
                        <tr key={item.id}>
                          <td>{item.sequence}</td>
                          <td>{labelSpineType(item)}</td>
                          <td>{item.title}</td>
                          <td>
                            {item.plannedWeeks == null
                              ? "—"
                              : item.plannedWeeks}
                          </td>
                          <td>{item.plannedOtjHours}</td>
                          <td>{item.assignedKsbCodes.length}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={`${styles.panel} ${styles.span2}`}>
            <div className={styles.panelHead}>
              <h2>KSB reference</h2>
              <div className={styles.filters}>
                {(["all", "knowledge", "skill", "behaviour"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      className={styles.filterBtn}
                      data-active={ksbFilter === f ? "true" : "false"}
                      onClick={() => setKsbFilter(f)}
                    >
                      {f}
                    </button>
                  ),
                )}
              </div>
            </div>
            <p className={styles.meta}>
              Reference only — read official KSB wording here. Assign KSBs in
              Spine Builder.
            </p>
            <div className={styles.ksbGrid}>
              {filteredKsbs.map((ksb) => {
                const open = expandedKsb === ksb.code;
                return (
                  <button
                    key={ksb.code}
                    type="button"
                    className={styles.ksbChip}
                    data-on={open ? "true" : "false"}
                    onClick={() =>
                      setExpandedKsb((cur) =>
                        cur === ksb.code ? null : ksb.code,
                      )
                    }
                    aria-expanded={open}
                  >
                    <strong>
                      {ksb.code}
                      <span className={styles.ksbTypeTag}>{ksb.type}</span>
                    </strong>
                    <span data-expanded={open ? "true" : "false"}>
                      {ksb.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.span2}`}>
            <h2>Official duties (locked)</h2>
            <p className={styles.meta}>
              Open a duty to see its KSBs. Select a KSB pill to read its
              wording.
            </p>
            {official.duties.length === 0 ? (
              <div className={styles.emptyDuties}>
                <p className={styles.meta}>
                  Skills England has not published duties for this standard
                  version yet. That is a Skills England gap, not a portal
                  import failure.
                </p>
                <p className={styles.meta}>
                  When duties are added upstream, re-load this apprenticeship
                  and they will appear here (locked), with their linked KSBs.
                </p>
                {official.ksbs.length > 0 ? (
                  <p className={styles.meta}>
                    Knowledge, skills and behaviours were imported (
                    {official.ksbs.length}) and are available for mapping once
                    duties exist.
                  </p>
                ) : null}
              </div>
            ) : (
              <ul className={styles.dutyList}>
                {official.duties.map((d) => {
                  const mapped = d.mappedKsbCodes.map((code) => {
                    const ksb = official.ksbs.find(
                      (k) => k.code.toUpperCase() === code.toUpperCase(),
                    );
                    return {
                      code,
                      type: ksb?.type ?? null,
                      description: ksb?.description ?? "Description not found",
                    };
                  });
                  const selectedCode =
                    selectedDutyKsb?.dutyCode === d.code
                      ? selectedDutyKsb.ksbCode
                      : null;
                  const selectedKsb = selectedCode
                    ? mapped.find(
                        (k) =>
                          k.code.toUpperCase() === selectedCode.toUpperCase(),
                      )
                    : null;
                  return (
                    <li key={d.code}>
                      <details
                        className={styles.dutyDetails}
                        onToggle={(e) => {
                          if (!(e.currentTarget as HTMLDetailsElement).open) {
                            setSelectedDutyKsb((cur) =>
                              cur?.dutyCode === d.code ? null : cur,
                            );
                          }
                        }}
                      >
                        <summary className={styles.dutySummary}>
                          <span className={styles.dutySummaryMain}>
                            <strong>{d.code}</strong> {d.description}
                          </span>
                          <span className={styles.dutySummaryCount}>
                            {mapped.length} KSB
                            {mapped.length === 1 ? "" : "s"}
                          </span>
                        </summary>
                        <div className={styles.dutyBody}>
                          {mapped.length === 0 ? (
                            <p className={styles.meta}>
                              No KSBs mapped to this duty.
                            </p>
                          ) : (
                            <>
                              <div className={styles.dutyKsbPills}>
                                {mapped.map((k) => {
                                  const on =
                                    selectedCode?.toUpperCase() ===
                                    k.code.toUpperCase();
                                  return (
                                    <button
                                      key={`${d.code}-${k.code}`}
                                      type="button"
                                      className={styles.dutyKsbPill}
                                      data-on={on ? "true" : "false"}
                                      data-type={k.type || "unknown"}
                                      onClick={() =>
                                        setSelectedDutyKsb((cur) =>
                                          cur?.dutyCode === d.code &&
                                          cur.ksbCode.toUpperCase() ===
                                            k.code.toUpperCase()
                                            ? null
                                            : {
                                                dutyCode: d.code,
                                                ksbCode: k.code,
                                              },
                                        )
                                      }
                                    >
                                      {k.code}
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedKsb ? (
                                <div className={styles.dutyKsbDetail}>
                                  <strong>{selectedKsb.code}</strong>
                                  {selectedKsb.type ? (
                                    <span className={styles.dutyKsbType}>
                                      {selectedKsb.type}
                                    </span>
                                  ) : null}
                                  <p>{selectedKsb.description}</p>
                                </div>
                              ) : (
                                <p className={styles.meta}>
                                  Select a KSB to read its description.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {state.programmes.length > 0 && (!programme || !official) ? (
        <section className={styles.panel}>
          <h2>Your programmes</h2>
          <ul className={styles.programmeList}>
            {state.programmes.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.linkish}
                  onClick={() => {
                    setTitleDraft(p.programmeTitle);
                    setSpineMode("view");
                    selectProgramme(p.id);
                  }}
                >
                  {p.programmeTitle} (v{p.internalVersion}
                  {p.externalVersion ? ` · SE v${p.externalVersion}` : ""})
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ApprenticePageShell>
  );
}
