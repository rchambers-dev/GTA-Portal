"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { updateEnrolment } from "@/features/administration/domain/store";
import {
  getProgrammeDefinitionSnapshot,
  subscribeProgrammeDefinition,
} from "@/features/programme-definition/domain/programme-definition-store";
import { calculateFixedCostTotal } from "@/features/programme-definition/domain/rpl-formulas";
import { buildApprenticeTnpPlan } from "../domain/apprentice-tnp-plan";
import { resolveProgrammeForEnrolment } from "../domain/resolve-enrolment-programme";
import {
  getAllApprenticeBlockRpl,
  getApprenticeRplServerSnapshot,
  getApprenticeRplSnapshot,
  subscribeApprenticeRplStore,
} from "../domain/apprentice-block-rpl-store";
import styles from "@/features/administration/screens/admin-pages.module.css";
import deliveryStyles from "./programme-delivery.module.css";

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n);
}

function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return (Math.round(n * 100) / 100).toString();
}

/**
 * Management — TNP1 from pinned programme version + learner RPL + finance config.
 */
export function ManagementApprenticeTnpScreen() {
  useSyncExternalStore(
    subscribeApprenticeRplStore,
    getApprenticeRplSnapshot,
    getApprenticeRplServerSnapshot,
  );
  const programmeState = useSyncExternalStore(
    subscribeProgrammeDefinition,
    getProgrammeDefinitionSnapshot,
    getProgrammeDefinitionSnapshot,
  );
  const admin = useAdminStore();
  const [apprenticeId, setApprenticeId] = useState("");
  const [bindBusy, setBindBusy] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

  const enrolments = useMemo(
    () =>
      admin.enrolments
        .filter((e) => e.status === "active" || e.status === "pending_start")
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [admin.enrolments],
  );

  const enrolment =
    enrolments.find((e) => e.apprenticeId === apprenticeId) ?? null;

  const resolution = useMemo(() => {
    if (!enrolment) return null;
    return resolveProgrammeForEnrolment({ enrolment, programmeState });
  }, [enrolment, programmeState]);

  const pinned = resolution?.status === "pinned" ? resolution : null;
  const rplByBlock = getAllApprenticeBlockRpl(apprenticeId);

  const plan =
    pinned && pinned.programme.parameters?.formulaKey === "block_ksb_value_v1"
      ? buildApprenticeTnpPlan({
          programme: pinned.programme,
          official: pinned.official,
          rplByBlockId: rplByBlock,
        })
      : null;

  const fixedLines = pinned?.programme.parameters?.fixedCostLines ?? [];
  const fixedTotal = calculateFixedCostTotal(fixedLines);

  const candidates =
    resolution &&
    (resolution.status === "unpinned" ||
      resolution.status === "pin_missing_programme")
      ? resolution.candidates
      : [];

  async function bindProgrammeVersion(programmeId: string) {
    if (!enrolment) return;
    setBindBusy(true);
    setBindError(null);
    try {
      await updateEnrolment(enrolment.id, {
        gtaProgrammeVersionId: programmeId || null,
      });
    } catch (err) {
      setBindError(
        err instanceof Error ? err.message : "Unable to bind programme version.",
      );
    } finally {
      setBindBusy(false);
    }
  }

  return (
    <ApprenticePageShell
      title="Apprentice TNP1"
      description="Negotiated training price for the enrolment’s pinned GTA programme version. Publishing a newer programme does not move existing learners."
      eyebrow="Management"
    >
      <div className={styles.root}>
        <div className={deliveryStyles.purpose}>
          <p className={deliveryStyles.purposeLead}>
            <strong>TNP1</strong> = Fixed cost total + Remaining variable cost
          </p>
          <p className={deliveryStyles.purposeBody}>
            Configure funding band and fixed-cost lines in{" "}
            <Link href="/management/programme-builder">Programme Builder</Link>
            . Enter learner recognition % on{" "}
            <Link href="/management/apprentice-funding">
              Apprentice funding (RPL)
            </Link>
            .
          </p>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.field} style={{ minWidth: "16rem" }}>
            <span>Apprentice</span>
            <select
              value={apprenticeId}
              onChange={(e) => setApprenticeId(e.target.value)}
            >
              <option value="">Select apprentice…</option>
              {enrolments.map((e) => (
                <option key={e.id} value={e.apprenticeId ?? e.id}>
                  {e.displayName} · {e.programmeName}
                  {e.gtaProgrammeVersionId ? "" : " · unpinned"}
                </option>
              ))}
            </select>
          </label>
        </div>

        {bindError ? <p className={styles.error}>{bindError}</p> : null}

        {!enrolment ? (
          <p className={styles.muted}>No enrolment selected.</p>
        ) : resolution && resolution.status !== "pinned" ? (
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Pin GTA programme version</h2>
            <p className={styles.muted}>{resolution.reason}</p>
            <label className={styles.field}>
              <span>Programme version</span>
              <select
                disabled={bindBusy || candidates.length === 0}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) void bindProgrammeVersion(e.target.value);
                }}
              >
                <option value="">
                  {candidates.length === 0
                    ? "No local programmes for this standard"
                    : "Select programme version to bind…"}
                </option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.programmeTitle} · internal v{p.internalVersion} · SE v
                    {p.externalVersion} · {p.parameters?.formulaKey}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ) : !plan || !pinned ? (
          <p className={styles.muted}>
            Pinned programme must use formula <code>block_ksb_value_v1</code> for
            TNP1.
            {pinned
              ? ` Current: ${pinned.programme.parameters?.formulaKey}.`
              : ""}
          </p>
        ) : (
          <>
            <div className={deliveryStyles.fundingStats}>
              <div className={deliveryStyles.fundingStat}>
                <span>Pinned programme</span>
                <strong>{pinned.programme.programmeTitle}</strong>
                <small>
                  v{pinned.programme.internalVersion} · SE v
                  {pinned.programme.externalVersion}
                </small>
              </div>
              <div className={deliveryStyles.fundingStat}>
                <span>Funding band</span>
                <strong>{money(plan.tnp.fundingBandPounds)}</strong>
              </div>
              <div className={deliveryStyles.fundingStat}>
                <span>Fixed cost total</span>
                <strong>{money(plan.tnp.fixedCostTotal)}</strong>
                <small>Not reduced by RPL</small>
              </div>
              <div className={deliveryStyles.fundingStat}>
                <span>TNP1</span>
                <strong>{money(plan.tnp.tnp1)}</strong>
                <ApprenticeStatusChip
                  tone={plan.tnp.allocatable ? "green" : "amber"}
                >
                  {plan.tnp.allocatable ? "Derived" : "Incomplete"}
                </ApprenticeStatusChip>
              </div>
            </div>

            {!plan.tnp.allocatable ? (
              <p className={styles.error}>{plan.tnp.blockedReason}</p>
            ) : null}

            <article className={styles.panel}>
              <h2 className={styles.panelTitle}>Cost build-up</h2>
              <div className={styles.stack}>
                <p className={styles.muted}>
                  Funding band: <strong>{money(plan.tnp.fundingBandPounds)}</strong>
                </p>
                <p className={styles.muted}>
                  − Fixed cost total:{" "}
                  <strong>{money(plan.tnp.fixedCostTotal)}</strong>
                </p>
                <p className={styles.muted}>
                  = Variable cost pot:{" "}
                  <strong>{money(plan.tnp.variableCostPot)}</strong>
                </p>
                <p className={styles.muted}>
                  Programme curriculum value:{" "}
                  <strong>{num(plan.tnp.programmeCurriculumValue)}</strong>
                </p>
                <p className={styles.muted}>
                  £ / curriculum unit:{" "}
                  <strong>{money(plan.tnp.poundsPerCurriculumUnit)}</strong>
                </p>
                <p className={styles.muted}>
                  Remaining curriculum value:{" "}
                  <strong>{num(plan.tnp.remainingProgrammeValue)}</strong>
                </p>
                <p className={styles.muted}>
                  Remaining variable £:{" "}
                  <strong>{money(plan.tnp.remainingVariableCost)}</strong>
                </p>
                <p>
                  TNP1: <strong>{money(plan.tnp.tnp1)}</strong>
                </p>
              </div>
            </article>

            <article className={styles.panel}>
              <h2 className={styles.panelTitle}>Fixed-cost lines</h2>
              {fixedLines.length === 0 ? (
                <p className={styles.muted}>
                  No fixed-cost lines on this programme version.
                </p>
              ) : (
                <div className={styles.stack}>
                  {fixedLines.map((line) => (
                    <p key={line.id} className={styles.muted}>
                      {line.enabled ? "" : "(off) "}
                      {line.label || "Untitled"} — {money(line.amountPounds)}
                    </p>
                  ))}
                </div>
              )}
              <p className={styles.muted}>
                Derived fixed total: <strong>{money(fixedTotal)}</strong>
              </p>
            </article>

            <article className={styles.panel}>
              <h2 className={styles.panelTitle}>RPL / OTJ context</h2>
              <p className={styles.muted}>
                Remaining OTJ {num(plan.rpl.remainingOtj)} hrs · Recognised OTJ{" "}
                {num(plan.rpl.recognisedOtj)} hrs
              </p>
            </article>
          </>
        )}
      </div>
    </ApprenticePageShell>
  );
}
