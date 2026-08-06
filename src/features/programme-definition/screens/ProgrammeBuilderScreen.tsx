"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
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
  getProgrammeDefinitionServerSnapshot,
  getProgrammeDefinitionSnapshot,
  goBackToCatalogue,
  replaceOfficialVersion,
  selectProgramme,
  subscribeProgrammeDefinition,
  updateProgrammeSpine,
  updateProgrammeTitle,
} from "../domain/programme-definition-store";
import type { OfficialStandardVersion, SpineItem } from "../domain/types";
import {
  isStructureLocked,
  summariseHours,
  toggleKsbOnBlock,
  validateProgrammeDefinition,
} from "../domain/validation";
import styles from "./programme-builder.module.css";

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

export function ProgrammeBuilderScreen() {
  const state = useProgrammeDefinition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedApprenticeship, setSelectedApprenticeship] =
    useState<ProgrammeApprenticeshipOption>(PROGRAMME_APPRENTICESHIPS[0]!);
  const [useTemplateIfAvailable, setUseTemplateIfAvailable] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [ksbFilter, setKsbFilter] = useState<
    "all" | "knowledge" | "skill" | "behaviour"
  >("all");
  const [titleDraft, setTitleDraft] = useState("");
  const [selectedDutyKsb, setSelectedDutyKsb] = useState<{
    dutyCode: string;
    ksbCode: string;
  } | null>(null);

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

  const hours = programme ? summariseHours(programme) : null;
  const issues =
    programme && official
      ? validateProgrammeDefinition(official, programme)
      : [];
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const blocks = useMemo(
    () =>
      programme?.spineItems
        .filter((i) => i.itemType === "block")
        .slice()
        .sort((a, b) => a.sequence - b.sequence) ?? [],
    [programme],
  );

  const selectedBlock =
    blocks.find((b) => b.id === selectedBlockId) ?? blocks[0] ?? null;

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
        createProgrammeForOfficial(localOfficial, {
          useDeliveryTemplate:
            useTemplateIfAvailable &&
            selectedApprenticeship.hasDeliveryTemplate,
        });
        setTitleDraft(localExisting.programmeTitle);
        setMessage(
          `Reopened saved draft for ${selectedApprenticeship.title} (no new version). Last saved ${formatSavedAt(localExisting.updatedAt)}.`,
        );
        return;
      }

      const res = await fetch("/api/management/programme-definition/import", {
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
      };

      if (!data.ok || !data.official) {
        throw new Error(
          data.error ||
            `${selectedApprenticeship.title} is not in the portal database and could not be imported from Skills England.`,
        );
      }

      const stored = replaceOfficialVersion(data.official);
      const opened = createProgrammeForOfficial(stored, {
        useDeliveryTemplate:
          useTemplateIfAvailable && selectedApprenticeship.hasDeliveryTemplate,
      });
      setTitleDraft(opened.programmeTitle);

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
      setMessage(err instanceof Error ? err.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }

  function onBack() {
    goBackToCatalogue();
    setMessage("Draft kept — come back anytime via Load or Your programmes.");
  }

  function onToggleKsb(code: string) {
    if (!programme || !selectedBlock || structureLocked) return;
    updateProgrammeSpine(programme.id, (p) => ({
      ...p,
      spineItems: toggleKsbOnBlock(p.spineItems, selectedBlock.id, code),
    }));
    setMessage(`Saved · ${formatSavedAt(new Date().toISOString())}`);
  }

  function onSaveTitle() {
    if (!programme) return;
    updateProgrammeTitle(programme.id, titleDraft || programme.programmeTitle);
    setMessage(`Title saved · ${formatSavedAt(new Date().toISOString())}`);
  }

  return (
    <ApprenticePageShell
      eyebrow="Management"
      title="Programme Builder"
      description="One GTA draft per Skills England version. Edits auto-save. A new version is only for a newer official release. Once apprentices are enrolled, structure is locked (wording can still be tidied)."
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
      {message ? <p className={styles.banner}>{message}</p> : null}

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
                        : item.hasDeliveryTemplate
                          ? " · GTA template available"
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
                Edits auto-save. Use Back to return here without losing work.
                New GTA version only when Skills England releases a newer
                version.
              </li>
            </ol>

            {selectedApprenticeship.hasDeliveryTemplate &&
            !savedDraftForSelected ? (
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={useTemplateIfAvailable}
                  onChange={(e) => setUseTemplateIfAvailable(e.target.checked)}
                />
                Use the existing GTA delivery template for this apprenticeship
                (blocks, gateways, EPA)
              </label>
            ) : savedDraftForSelected ? (
              <p className={styles.meta}>
                Saved draft will reopen as-is (Internal v
                {savedDraftForSelected.internalVersion},{" "}
                {savedDraftForSelected.status}).
              </p>
            ) : (
              <p className={styles.meta}>
                No GTA delivery template yet for this apprenticeship — load will
                create a starter spine (Block 1 + EPA) you can expand.
              </p>
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
                Apprentices are on this version (or it is published). Spine,
                hours, and KSB assignments cannot change. Titles and wording
                can still be updated.
              </p>
            ) : null}
            <div className={styles.hoursBox}>
              <div>
                <span>Target (min compliance)</span>
                <strong>
                  {numOrDash(official.minimumComplianceHours)} hrs
                </strong>
              </div>
              <div>
                <span>Structure planned OTJ</span>
                <strong>{hours?.structurePlannedOtjHours ?? 0} hrs</strong>
              </div>
              <div>
                <span>Remaining vs target</span>
                <strong>
                  {official.minimumComplianceHours != null
                    ? `${Math.max(
                        0,
                        Math.round(
                          (official.minimumComplianceHours -
                            (hours?.structurePlannedOtjHours ?? 0)) *
                            10,
                        ) / 10,
                      )} hrs`
                    : "—"}
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
            <h2>Spine</h2>
            <p className={styles.meta}>
              Structure is GTA-owned. Official wording above stays locked.
              {structureLocked
                ? " Structure editing is locked while apprentices are enrolled."
                : " Select a block to assign KSBs."}
            </p>
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
                      <tr
                        key={item.id}
                        data-active={
                          selectedBlock?.id === item.id ? "true" : "false"
                        }
                        onClick={() => {
                          if (item.itemType === "block")
                            setSelectedBlockId(item.id);
                        }}
                      >
                        <td>{item.sequence}</td>
                        <td>{labelType(item)}</td>
                        <td>{item.title}</td>
                        <td>
                          {item.plannedWeeks == null ? "—" : item.plannedWeeks}
                        </td>
                        <td>{item.plannedOtjHours}</td>
                        <td>{item.assignedKsbCodes.length}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.span2}`}>
            <div className={styles.panelHead}>
              <h2>
                KSB bucket
                {selectedBlock
                  ? ` → ${selectedBlock.title}`
                  : " (select a block)"}
              </h2>
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
            {structureLocked ? (
              <p className={styles.lockNote}>
                KSB assignments are locked on this version.
              </p>
            ) : null}
            {!selectedBlock ? (
              <p className={styles.meta}>Select a block in the spine table.</p>
            ) : (
              <div className={styles.ksbGrid}>
                {filteredKsbs.map((ksb) => {
                  const on = selectedBlock.assignedKsbCodes.some(
                    (c) => c.toUpperCase() === ksb.code.toUpperCase(),
                  );
                  return (
                    <button
                      key={ksb.code}
                      type="button"
                      className={styles.ksbChip}
                      data-on={on ? "true" : "false"}
                      disabled={structureLocked}
                      onClick={() => onToggleKsb(ksb.code)}
                      title={ksb.description}
                    >
                      <strong>{ksb.code}</strong>
                      <span>{ksb.description}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`${styles.panel} ${styles.span2}`}>
            <h2>Official duties (locked)</h2>
            <p className={styles.meta}>
              Open a duty to see its KSBs. Select a KSB pill to read its
              wording.
            </p>
            {official.duties.length === 0 ? (
              <p className={styles.meta}>
                No duties were imported for this standard version.
              </p>
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

function labelType(item: SpineItem): string {
  if (item.itemType === "gateway") return "Gateway";
  if (item.itemType === "epa") return "EPA";
  if (item.itemType === "block") return "Block";
  return item.itemType;
}
