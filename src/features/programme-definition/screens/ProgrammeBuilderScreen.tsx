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
  replaceOfficialVersion,
  selectProgramme,
  subscribeProgrammeDefinition,
  updateProgrammeSpine,
} from "../domain/programme-definition-store";
import type { OfficialStandardVersion, SpineItem } from "../domain/types";
import {
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

  const programme = state.programmes.find(
    (p) => p.id === state.selectedProgrammeId,
  );
  const official = programme
    ? state.officialVersions.find((v) => v.id === programme.standardVersionId)
    : state.officialVersions[0];

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

  async function importSelected() {
    setBusy(true);
    setMessage(null);
    try {
      // System first (portal DB), then Skills England if missing. No silent offline fallback.
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
      createProgrammeForOfficial(stored, {
        useDeliveryTemplate:
          useTemplateIfAvailable && selectedApprenticeship.hasDeliveryTemplate,
      });

      const base =
        data.message ||
        (data.source === "database"
          ? `Loaded ${selectedApprenticeship.title} from the portal database.`
          : `Imported ${selectedApprenticeship.title} from Skills England and saved.`);
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

  function onToggleKsb(code: string) {
    if (!programme || !selectedBlock) return;
    updateProgrammeSpine(programme.id, (p) => ({
      ...p,
      spineItems: toggleKsbOnBlock(p.spineItems, selectedBlock.id, code),
    }));
  }

  return (
    <ApprenticePageShell
      eyebrow="Management"
      title="Programme Builder"
      description="Choose an apprenticeship. If it is already in the portal it loads from the database; if not, it is imported once from Skills England and saved. Then build GTA’s delivery spine and assign KSBs to blocks."
      actions={
        <div className={adminStyles.toolbarActions}>
          <Link
            href="/management/course-builder"
            className={adminStyles.secondaryBtn}
          >
            Course Builder
          </Link>
          <button
            type="button"
            className={adminStyles.primaryBtn}
            disabled={busy || !selectedApprenticeship}
            onClick={() => importSelected()}
          >
            {busy ? "Working…" : `Load ${selectedApprenticeship.title}`}
          </button>
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
                      {item.hasDeliveryTemplate
                        ? " · GTA template available"
                        : " · Spine not built yet"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.panel}>
            <h2>Load {selectedApprenticeship.title}</h2>
            <ol className={styles.steps}>
              <li>
                If this apprenticeship is already in the portal database, open
                that locked version (no duplicate).
              </li>
              <li>
                If it is not in the database, import it from Skills England once
                and save it.
              </li>
              <li>
                Start a GTA programme draft — empty spine, or a delivery template
                where one exists. Assign KSBs to blocks here; tasks later in
                Course Builder.
              </li>
            </ol>

            {selectedApprenticeship.hasDeliveryTemplate ? (
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={useTemplateIfAvailable}
                  onChange={(e) => setUseTemplateIfAvailable(e.target.checked)}
                />
                Use the existing GTA delivery template for this apprenticeship
                (blocks, gateways, EPA)
              </label>
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
              <ApprenticeStatusChip tone="amber">
                {programme.status}
              </ApprenticeStatusChip>
            </div>
            <p className={styles.lead}>{programme.programmeTitle}</p>
            <p className={styles.meta}>
              Internal v{programme.internalVersion} ·{" "}
              {hours?.blockCount ?? 0} blocks · {hours?.gatewayCount ?? 0}{" "}
              gateways · EPA {hours?.hasEpa ? "present" : "missing"}
            </p>
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
                    data-sev={issue.severity}
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
              Select a block to assign KSBs.
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
            <ul className={styles.dutyList}>
              {official.duties.map((d) => (
                <li key={d.code}>
                  <strong>{d.code}</strong> {d.description}
                  <span className={styles.meta}>
                    Maps to {d.mappedKsbCodes.length} KSBs
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {state.programmes.length > 0 ? (
        <section className={styles.panel}>
          <h2>Your programmes</h2>
          <ul className={styles.programmeList}>
            {state.programmes.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.linkish}
                  onClick={() => selectProgramme(p.id)}
                >
                  {p.programmeTitle} (v{p.internalVersion})
                </button>
              </li>
            ))}
          </ul>
          {!programme ? (
            <p className={styles.meta}>
              Open one above, or import another apprenticeship.
            </p>
          ) : null}
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
