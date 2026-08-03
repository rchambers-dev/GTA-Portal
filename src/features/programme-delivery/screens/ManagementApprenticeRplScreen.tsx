"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { formatDisplayDate } from "@/features/apprentice-lifecycle/domain/programme-week";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { AUTOCARE_BLOCKS, AUTOCARE_STANDARD } from "../domain/autocare-blocks";
import {
  buildApprenticeFundingPlan,
  clampRplPct,
  emptyBlockRpl,
  RPL_MAX_DEDUCTION,
  RPL_STEP,
  RPL_WEIGHT_B,
  RPL_WEIGHT_K,
  RPL_WEIGHT_S,
  type BlockRplInput,
} from "../domain/rpl-funding-calc";
import {
  getAllApprenticeBlockRpl,
  getApprenticeRplServerSnapshot,
  getApprenticeRplSnapshot,
  resetApprenticeBlockRpl,
  setApprenticeBlockRpl,
  subscribeApprenticeRplStore,
} from "../domain/apprentice-block-rpl-store";
import styles from "@/features/administration/screens/admin-pages.module.css";
import deliveryStyles from "./programme-delivery.module.css";

function formatMoney(gbp: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(gbp);
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={deliveryStyles.rplStepper}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => onChange(clampRplPct(value - RPL_STEP))}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <strong>{value}%</strong>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => onChange(clampRplPct(value + RPL_STEP))}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </label>
  );
}

/**
 * Management — per-apprentice K/S/B RPL adjustments for funding / compliance.
 * Does not change apprentice-facing cohort weeks (GTA does not fast-track delivery).
 */
export function ManagementApprenticeRplScreen() {
  useSyncExternalStore(
    subscribeApprenticeRplStore,
    getApprenticeRplSnapshot,
    getApprenticeRplServerSnapshot,
  );
  const admin = useAdminStore();
  const [apprenticeId, setApprenticeId] = useState<string>("lrn-alex-morgan");

  const enrolments = useMemo(
    () =>
      admin.enrolments
        .filter((e) => e.status === "active" || e.status === "pending_start")
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [admin.enrolments],
  );

  const enrolment = enrolments.find((e) => e.apprenticeId === apprenticeId) ?? null;
  const cohort = enrolment?.cohortId
    ? admin.cohorts.find((c) => c.id === enrolment.cohortId)
    : null;

  const cohortStartDate =
    cohort?.startDate || enrolment?.startDate || "2024-09-02";
  const deliveryEnd =
    cohort?.expectedEndDate || enrolment?.originalPlannedEndDate || null;

  const rplByBlock = getAllApprenticeBlockRpl(apprenticeId);
  const plan = buildApprenticeFundingPlan({
    cohortStartDate,
    deliveryExpectedEndDate: deliveryEnd,
    rplByBlock,
  });

  function patchBlock(blockId: number, patch: Partial<BlockRplInput>) {
    const current = rplByBlock[blockId] ?? emptyBlockRpl();
    setApprenticeBlockRpl(apprenticeId, blockId, { ...current, ...patch });
  }

  return (
    <ApprenticePageShell
      title="Apprentice programme funding (RPL / KSB)"
      description="Adjust Knowledge, Skills and Behaviours prior learning per block for funding and compliance. GTA does not fast-track delivery — apprentices keep cohort weeks; this plan is for management."
      eyebrow="Management"
    >
      <div className={styles.root}>
        <div className={deliveryStyles.purpose}>
          <p className={deliveryStyles.purposeLead}>
            <strong>
              {AUTOCARE_STANDARD.label} · {AUTOCARE_STANDARD.code}{" "}
              {AUTOCARE_STANDARD.version}
            </strong>
            {" · "}
            Band {formatMoney(AUTOCARE_STANDARD.fundingBandGbp)} · K{" "}
            {Math.round(RPL_WEIGHT_K * 100)}% / S{" "}
            {Math.round(RPL_WEIGHT_S * 100)}% / B{" "}
            {Math.round(RPL_WEIGHT_B * 100)}% · max{" "}
            {Math.round(RPL_MAX_DEDUCTION * 100)}% OTJ off per block
          </p>
          <p className={deliveryStyles.purposeBody}>
            Cohort start drives the calendar. Changing K/S/B shortens that
            apprentice&apos;s <em>funding</em> session plan and indicative finish —
            not the classroom timetable they share with their batch.
          </p>
          <p className={deliveryStyles.purposeNote}>
            Not fast-track: delivery stays with the cohort. Use this for planned
            OTJ, funding indication, and audit — Excel remains the audit copy.
          </p>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.field} style={{ minWidth: "16rem" }}>
            <span>Apprentice</span>
            <select
              value={apprenticeId}
              onChange={(e) => setApprenticeId(e.target.value)}
            >
              {enrolments.map((e) => (
                <option key={e.id} value={e.apprenticeId ?? e.id}>
                  {e.displayName} · {e.programmeName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => resetApprenticeBlockRpl(apprenticeId)}
          >
            Reset all RPL for apprentice
          </button>
        </div>

        {enrolment ? (
          <div className={deliveryStyles.fundingStats}>
            <div className={deliveryStyles.fundingStat}>
              <span>Cohort start</span>
              <strong>
                {formatDisplayDate(new Date(`${cohortStartDate}T12:00:00.000Z`))}
              </strong>
              <small>{cohort?.name ?? "Enrolment start"}</small>
            </div>
            <div className={deliveryStyles.fundingStat}>
              <span>Delivery expected end</span>
              <strong>
                {deliveryEnd
                  ? formatDisplayDate(new Date(`${deliveryEnd}T12:00:00.000Z`))
                  : "—"}
              </strong>
              <small>Cohort / enrolment (unchanged)</small>
            </div>
            <div className={deliveryStyles.fundingStat}>
              <span>Funding expected finish</span>
              <strong>
                {plan.fundingExpectedFinishDate
                  ? formatDisplayDate(
                      new Date(`${plan.fundingExpectedFinishDate}T12:00:00.000Z`),
                    )
                  : "—"}
              </strong>
              <small>RPL-compressed plan · management only</small>
            </div>
            <div className={deliveryStyles.fundingStat}>
              <span>Planned → adjusted OTJ</span>
              <strong>
                {plan.plannedOtjHours} → {plan.adjustedOtjHours} hrs
              </strong>
              <small>
                Programme RPL {plan.programmeRplPercent}% · indicative{" "}
                {formatMoney(plan.indicativeFundingGbp)}
              </small>
            </div>
          </div>
        ) : (
          <p className={styles.muted}>No enrolment selected.</p>
        )}

        <div className={styles.stack}>
          {AUTOCARE_BLOCKS.map((block) => {
            const row = plan.blocks.find((b) => b.blockId === block.id);
            if (!row) return null;
            const canAdjust = block.plannedOtjHours > 0;
            return (
              <article key={block.id} className={styles.panel}>
                <div className={deliveryStyles.fundingBlockHead}>
                  <div>
                    <h2 className={styles.panelTitle}>
                      Block {block.id} · {block.name}
                    </h2>
                    <p className={styles.muted}>
                      {block.kind} · {block.plannedOtjHours} hrs planned OTJ
                      {block.weekStart != null && block.weekEnd != null
                        ? ` · apprentice weeks ${block.weekStart}–${block.weekEnd}`
                        : " · no apprentice week range"}
                    </p>
                  </div>
                  <ApprenticeStatusChip
                    tone={row.deductionHours > 0 ? "amber" : "neutral"}
                  >
                    {row.deductionHours > 0
                      ? `−${row.deductionHours} hrs`
                      : "No RPL"}
                  </ApprenticeStatusChip>
                </div>

                {canAdjust ? (
                  <div className={styles.formGrid}>
                    <Stepper
                      label="Knowledge already held"
                      value={row.knowledgePct}
                      onChange={(knowledgePct) =>
                        patchBlock(block.id, { knowledgePct })
                      }
                    />
                    <Stepper
                      label="Skills already demonstrated"
                      value={row.skillsPct}
                      onChange={(skillsPct) =>
                        patchBlock(block.id, { skillsPct })
                      }
                    />
                    <Stepper
                      label="Behaviours already evidenced"
                      value={row.behavioursPct}
                      onChange={(behavioursPct) =>
                        patchBlock(block.id, { behavioursPct })
                      }
                    />
                  </div>
                ) : (
                  <p className={styles.muted}>
                    Blocks with 0 planned OTJ (Pre-EPA consolidation / EPA) still
                    list for evidence, but RPL does not reduce funding hours
                    here.
                  </p>
                )}

                <p className={deliveryStyles.fundingMeta}>
                  Adjusted OTJ: <strong>{row.adjustedOtjHours} hrs</strong> (
                  {row.sessions} sessions)
                  {" · "}
                  Funding window:{" "}
                  <strong>
                    {row.fundingStartDate && row.fundingEndDate
                      ? `${formatDisplayDate(new Date(`${row.fundingStartDate}T12:00:00.000Z`))} – ${formatDisplayDate(new Date(`${row.fundingEndDate}T12:00:00.000Z`))}`
                      : "—"}
                  </strong>
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </ApprenticePageShell>
  );
}
