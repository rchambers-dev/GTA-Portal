"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import { formatDisplayDate } from "@/features/apprentice-lifecycle/domain/programme-week";
import { useAdminStore } from "@/features/administration/hooks/useAdminStore";
import { updateEnrolment } from "@/features/administration/domain/store";
import {
  getProgrammeDefinitionSnapshot,
  subscribeProgrammeDefinition,
} from "@/features/programme-definition/domain/programme-definition-store";
import {
  availableRplDimensions,
  RPL_DIMENSION_LABELS,
  RPL_DIMENSION_PCT_FIELD,
  type RplDimension,
} from "@/features/programme-definition/domain/rpl-formulas";
import { AUTOCARE_BLOCKS } from "../domain/autocare-blocks";
import {
  buildApprenticeFundingPlan,
  emptyBlockRpl,
  RPL_STEP,
  type BlockRplInput,
} from "../domain/rpl-funding-calc";
import { buildBlockKsbValuePlanForProgramme } from "../domain/block-ksb-value-plan";
import { resolveProgrammeForEnrolment } from "../domain/resolve-enrolment-programme";
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

function formatHours(n: number): string {
  return (Math.round(n * 10) / 10).toString();
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
          onClick={() => onChange(Math.max(0, value - RPL_STEP))}
          aria-label={`Decrease ${label}`}
          disabled={value <= 0}
        >
          −
        </button>
        <strong>{value}%</strong>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => onChange(Math.min(100, value + RPL_STEP))}
          aria-label={`Increase ${label}`}
          disabled={value >= 100}
        >
          +
        </button>
      </div>
    </label>
  );
}

function DimensionSteppers({
  dimensions,
  learner,
  onPatch,
}: {
  dimensions: RplDimension[];
  learner: BlockRplInput;
  onPatch: (patch: Partial<BlockRplInput>) => void;
}) {
  if (dimensions.length === 0) {
    return (
      <p className={styles.muted}>
        No Knowledge / Skill / Behaviour categories on the bound official
        standard version.
      </p>
    );
  }
  return (
    <div className={styles.formGrid}>
      {dimensions.map((dim) => {
        const field = RPL_DIMENSION_PCT_FIELD[dim];
        return (
          <Stepper
            key={dim}
            label={RPL_DIMENSION_LABELS[dim]}
            value={learner[field]}
            onChange={(next) => onPatch({ [field]: next })}
          />
        );
      })}
    </div>
  );
}

/**
 * Management — per-apprentice RPL adjustments against a pinned GTA programme version.
 */
export function ManagementApprenticeRplScreen() {
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
  const [apprenticeId, setApprenticeId] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bindBusy, setBindBusy] = useState(false);

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

  const learnerStartDate = enrolment?.startDate || "2024-09-02";
  const deliveryEnd = enrolment?.originalPlannedEndDate || null;

  const resolution = useMemo(() => {
    if (!enrolment) return null;
    return resolveProgrammeForEnrolment({
      enrolment,
      programmeState,
    });
  }, [enrolment, programmeState]);

  const pinned =
    resolution?.status === "pinned" ? resolution : null;
  const valueShareProgramme =
    pinned && pinned.programme.parameters?.formulaKey === "block_ksb_value_v1"
      ? pinned.programme
      : null;
  const official = pinned?.official ?? null;

  const rplDimensions = useMemo(
    () =>
      official
        ? availableRplDimensions(official.ksbs, valueShareProgramme?.parameters)
        : [],
    [official, valueShareProgramme?.parameters],
  );

  const rplByBlock = getAllApprenticeBlockRpl(apprenticeId);

  const valueSharePlan =
    valueShareProgramme && official
      ? buildBlockKsbValuePlanForProgramme({
          programme: valueShareProgramme,
          official,
          rplByBlockId: rplByBlock,
        })
      : null;

  const useLegacy =
    Boolean(enrolment) &&
    !valueSharePlan &&
    resolution?.status !== "unpinned" &&
    resolution?.status !== "pin_missing_programme";

  const legacyPlan = useLegacy
    ? buildApprenticeFundingPlan({
        cohortStartDate: learnerStartDate,
        deliveryExpectedEndDate: deliveryEnd,
        rplByBlock: Object.fromEntries(
          Object.entries(rplByBlock).map(([k, v]) => [Number(k), v]),
        ),
      })
    : null;

  function patchBlock(blockId: string | number, patch: Partial<BlockRplInput>) {
    const current = rplByBlock[String(blockId)] ?? emptyBlockRpl();
    // Force absent dimensions to 0 so leftover % cannot affect calc.
    const cleared: BlockRplInput = {
      knowledgePct: rplDimensions.includes("knowledge")
        ? current.knowledgePct
        : 0,
      skillsPct: rplDimensions.includes("skill") ? current.skillsPct : 0,
      behavioursPct: rplDimensions.includes("behaviour")
        ? current.behavioursPct
        : 0,
    };
    const next = { ...cleared, ...patch };
    const result = setApprenticeBlockRpl(apprenticeId, blockId, next);
    setSaveError(result.ok ? null : result.error);
  }

  async function bindProgrammeVersion(programmeId: string) {
    if (!enrolment) return;
    setBindBusy(true);
    setSaveError(null);
    try {
      await updateEnrolment(enrolment.id, {
        gtaProgrammeVersionId: programmeId || null,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to bind programme version.",
      );
    } finally {
      setBindBusy(false);
    }
  }

  const candidates =
    resolution &&
    (resolution.status === "unpinned" ||
      resolution.status === "pin_missing_programme")
      ? resolution.candidates
      : [];

  return (
    <ApprenticePageShell
      title="Apprentice programme funding (RPL / KSB)"
      description="Adjust prior learning % against the enrolment’s pinned GTA programme version. Newer published programmes do not move existing learners automatically."
      eyebrow="Management"
    >
      <div className={styles.root}>
        <div className={deliveryStyles.purpose}>
          <p className={deliveryStyles.purposeLead}>
            {valueSharePlan && valueShareProgramme ? (
              <>
                <strong>{valueShareProgramme.programmeTitle}</strong>
                {" · "}
                Programme v{valueShareProgramme.internalVersion}
                {" · "}
                SE v{valueShareProgramme.externalVersion}
                {" · "}
                <code>block_ksb_value_v1</code>
              </>
            ) : (
              <>
                Bind each enrolment to an exact GTA programme version before
                curriculum-value RPL / TNP.
              </>
            )}
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
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={!apprenticeId}
            onClick={() => resetApprenticeBlockRpl(apprenticeId)}
          >
            Reset all RPL for apprentice
          </button>
        </div>

        {saveError ? <p className={styles.error}>{saveError}</p> : null}

        {enrolment && resolution && resolution.status !== "pinned" ? (
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
                    {p.status === "published" ? " · published" : ` · ${p.status}`}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ) : null}

        {enrolment &&
        pinned &&
        pinned.programme.parameters?.formulaKey !== "block_ksb_value_v1" ? (
          <p className={styles.muted}>
            Pinned programme uses formula{" "}
            <code>{pinned.programme.parameters?.formulaKey}</code>. Curriculum-value
            RPL UI requires <code>block_ksb_value_v1</code>. Showing legacy path
            where available.
          </p>
        ) : null}

        {enrolment && valueSharePlan ? (
          <div className={deliveryStyles.fundingStats}>
            <div className={deliveryStyles.fundingStat}>
              <span>Programme curriculum value</span>
              <strong>
                {formatHours(valueSharePlan.programmeCurriculumValue)}
              </strong>
            </div>
            <div className={deliveryStyles.fundingStat}>
              <span>Recognised → remaining value</span>
              <strong>
                {formatHours(valueSharePlan.recognisedProgrammeValue)} →{" "}
                {formatHours(valueSharePlan.remainingProgrammeValue)}
              </strong>
            </div>
            <div className={deliveryStyles.fundingStat}>
              <span>Recognised → remaining OTJ</span>
              <strong>
                {valueSharePlan.otjAllocatable
                  ? `${formatHours(valueSharePlan.recognisedOtj)} → ${formatHours(valueSharePlan.remainingOtj)} hrs`
                  : "Set expected OTJ on the programme"}
              </strong>
            </div>
            <div className={deliveryStyles.fundingStat}>
              <span>RPL dimensions</span>
              <strong>
                {rplDimensions.length
                  ? rplDimensions.join(", ")
                  : "none on official pack"}
              </strong>
              <small>From bound Skills England version</small>
            </div>
          </div>
        ) : null}

        {enrolment && legacyPlan ? (
          <div className={deliveryStyles.fundingStats}>
            <div className={deliveryStyles.fundingStat}>
              <span>Apprenticeship start</span>
              <strong>
                {formatDisplayDate(new Date(`${learnerStartDate}T12:00:00.000Z`))}
              </strong>
            </div>
            <div className={deliveryStyles.fundingStat}>
              <span>Planned → adjusted OTJ (legacy)</span>
              <strong>
                {legacyPlan.plannedOtjHours} → {legacyPlan.adjustedOtjHours} hrs
              </strong>
            </div>
          </div>
        ) : null}

        {!enrolment ? <p className={styles.muted}>No enrolment selected.</p> : null}

        <div className={styles.stack}>
          {valueSharePlan && valueShareProgramme
            ? valueShareProgramme.spineItems
                .filter((i) => i.itemType === "block")
                .map((block) => {
                  const row = valueSharePlan.blocks.find(
                    (b) => b.blockId === block.id,
                  );
                  if (!row) return null;
                  const learner = rplByBlock[block.id] ?? emptyBlockRpl();
                  return (
                    <article key={block.id} className={styles.panel}>
                      <div className={deliveryStyles.fundingBlockHead}>
                        <div>
                          <h2 className={styles.panelTitle}>{block.title}</h2>
                          <p className={styles.muted}>
                            Curriculum K {formatHours(row.knowledgeValue)} / S{" "}
                            {formatHours(row.skillsValue)} / B{" "}
                            {formatHours(row.behaviourValue)} · Block value{" "}
                            {formatHours(row.blockValue)}
                          </p>
                        </div>
                        <ApprenticeStatusChip
                          tone={
                            row.recognisedBlockValue > 0 ? "amber" : "neutral"
                          }
                        >
                          {row.recognisedFraction > 0
                            ? `${Math.round(row.recognisedFraction * 1000) / 10}% recognised`
                            : "No RPL"}
                        </ApprenticeStatusChip>
                      </div>

                      <DimensionSteppers
                        dimensions={rplDimensions}
                        learner={learner}
                        onPatch={(patch) => patchBlock(block.id, patch)}
                      />

                      <p className={deliveryStyles.fundingMeta}>
                        Recognised value:{" "}
                        <strong>{formatHours(row.recognisedBlockValue)}</strong>
                        {" · "}
                        Remaining:{" "}
                        <strong>{formatHours(row.remainingBlockValue)}</strong>
                        {" · "}
                        Remaining OTJ:{" "}
                        <strong>{formatHours(row.remainingOtj)} hrs</strong>
                      </p>
                    </article>
                  );
                })
            : null}

          {legacyPlan
            ? AUTOCARE_BLOCKS.map((block) => {
                const row = legacyPlan.blocks.find((b) => b.blockId === block.id);
                if (!row) return null;
                const canAdjust = block.plannedOtjHours > 0;
                const legacyDims: RplDimension[] = [
                  "knowledge",
                  "skill",
                  "behaviour",
                ];
                return (
                  <article key={block.id} className={styles.panel}>
                    <div className={deliveryStyles.fundingBlockHead}>
                      <div>
                        <h2 className={styles.panelTitle}>
                          Block {block.id} · {block.name}
                        </h2>
                        <p className={styles.muted}>
                          Legacy weighted path · {block.plannedOtjHours} hrs
                          planned OTJ
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
                      <DimensionSteppers
                        dimensions={legacyDims}
                        learner={{
                          knowledgePct: row.knowledgePct,
                          skillsPct: row.skillsPct,
                          behavioursPct: row.behavioursPct,
                        }}
                        onPatch={(patch) => patchBlock(block.id, patch)}
                      />
                    ) : (
                      <p className={styles.muted}>
                        No planned OTJ — RPL does not adjust hours here.
                      </p>
                    )}
                    <p className={deliveryStyles.fundingMeta}>
                      Adjusted OTJ: <strong>{row.adjustedOtjHours} hrs</strong>
                    </p>
                  </article>
                );
              })
            : null}
        </div>
      </div>
    </ApprenticePageShell>
  );
}
