"use client";

import type { CurriculumCoverageSnapshot } from "../domain/curriculum-coverage";
import { CurriculumAnalysisPanel } from "./CurriculumAnalysisPanel";
import styles from "./programme-builder.module.css";

type Props = {
  snapshot: CurriculumCoverageSnapshot;
  programmeVersionId?: string | null;
  onOpenSpineBuilder?: () => void;
  structureLocked?: boolean;
};

export function CurriculumCoveragePanel({
  snapshot,
  programmeVersionId = null,
  onOpenSpineBuilder,
  structureLocked,
}: Props) {
  const pct = snapshot.officialRequired
    ? Math.round(
        (snapshot.approvedPrimaryCount / snapshot.officialRequired) * 100,
      )
    : 0;

  return (
    <section
      className={`${styles.panel} ${styles.span2}`}
      aria-label="Curriculum Coverage and Gaps"
    >
      <div className={styles.panelHead}>
        <h2>Curriculum Coverage / Gap</h2>
        <span
          className={styles.coverageStatusChip}
          data-tone={snapshot.publicationBlocked ? "blocked" : "ready"}
        >
          {snapshot.publicationBlocked
            ? "Publication blocked"
            : "Primary coverage complete"}
        </span>
      </div>

      <p className={styles.coverageIntro}>
        Authoritative coverage comes only from approved Primary mappings
        persisted on this programme version. Reviewed gaps and proposed
        amendments are review evidence — they never count as current coverage.
      </p>

      {snapshot.publicationBlocked ? (
        <div className={styles.coverageBlockedBanner} role="status">
          <strong>Publication blocked.</strong> {snapshot.publicationBlockReason}
        </div>
      ) : null}

      <div className={styles.coverageMetrics}>
        <div>
          <span>Official requirement</span>
          <strong>{snapshot.officialRequired}</strong>
        </div>
        <div>
          <span>Approved Primaries (DB)</span>
          <strong>
            {snapshot.approvedPrimaryCount} / {snapshot.officialRequired}
          </strong>
        </div>
        <div>
          <span>Reviewed curriculum gaps</span>
          <strong>{snapshot.reviewedGapCount}</strong>
        </div>
        <div>
          <span>Distributed-skill / Primary-ownership review</span>
          <strong>{snapshot.distributedSkillCount}</strong>
        </div>
        <div>
          <span>Not yet resolved / reviewed</span>
          <strong>{snapshot.notYetResolvedCount}</strong>
        </div>
      </div>

      <div
        className={styles.coverageBar}
        role="progressbar"
        aria-valuenow={snapshot.approvedPrimaryCount}
        aria-valuemin={0}
        aria-valuemax={snapshot.officialRequired || 1}
        aria-label="Official KSBs with approved Primary"
      >
        <span style={{ width: `${pct}%` }} />
      </div>

      <div className={styles.coverageIntegrity}>
        <span>
          Duplicate Primaries: <strong>{snapshot.duplicatePrimaryCount}</strong>
        </span>
        <span>
          Non-block Primaries:{" "}
          <strong>{snapshot.nonBlockPrimaryCount}</strong>
        </span>
        <span>
          Gateway/EPA mappings:{" "}
          <strong>{snapshot.gatewayEpaMappingCount}</strong>
        </span>
      </div>

      <div className={styles.coverageLayers}>
        <article className={styles.coverageLayer} data-layer="official">
          <h3>Official requirement</h3>
          <p>
            Skills England catalogue for this standard:{" "}
            <strong>{snapshot.officialRequired}</strong> KSBs must each have
            exactly one approved Primary teaching location before publish.
          </p>
        </article>

        <article className={styles.coverageLayer} data-layer="truth">
          <h3>Current programme truth</h3>
          <p>
            Approved Primaries persisted in the database:{" "}
            <strong>
              {snapshot.approvedPrimaryCount} / {snapshot.officialRequired}
            </strong>
            . Proposed future Primaries are excluded.
          </p>
          {snapshot.approvedPrimaries.length > 0 ? (
            <div className={styles.coverageChips}>
              {snapshot.approvedPrimaries.map((row) => (
                <span
                  key={row.ksbCode}
                  className={styles.coverageChip}
                  data-state="approved"
                  title={`${row.blockTitle} · ${row.learningIntent} · value ${row.curriculumValue}`}
                >
                  {row.ksbCode}
                  {row.blockNumber != null ? ` → B${row.blockNumber}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className={styles.coverageEmpty}>
              No approved Primary mappings persisted yet.
            </p>
          )}
        </article>

        <article className={styles.coverageLayer} data-layer="gap">
          <h3>Reviewed curriculum gaps</h3>
          <p>
            Human-reviewed KSBs where the current original SOW has no defensible
            Primary teaching location:{" "}
            <strong>{snapshot.reviewedGapCount}</strong>
            {snapshot.reviewedRegister
              ? ` across ${snapshot.reviewedRegister.groups.length} groups`
              : ""}
            .
          </p>
          {snapshot.reviewedRegister ? (
            <div className={styles.coverageGapGroups}>
              {snapshot.reviewedRegister.groups.map((group) => (
                <details key={group.groupId} className={styles.coverageGapGroup}>
                  <summary>
                    <span>{group.title}</span>
                    <span className={styles.checklistCount}>
                      {group.ksbs.length}
                    </span>
                  </summary>
                  <p>{group.reason}</p>
                  <div className={styles.coverageChips}>
                    {group.ksbs.map((code) => (
                      <span
                        key={code}
                        className={styles.coverageChip}
                        data-state="gap"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                  {group.affectedBlocks.length > 0 ? (
                    <p className={styles.coverageMeta}>
                      Affected / candidate blocks (review):{" "}
                      {group.affectedBlocks.map((n) => `B${n}`).join(", ")}
                    </p>
                  ) : null}
                </details>
              ))}
            </div>
          ) : (
            <p className={styles.coverageEmpty}>
              No reviewed curriculum-gap register attached to this programme
              version.
            </p>
          )}
        </article>

        <article className={styles.coverageLayer} data-layer="distributed">
          <h3>Distributed-skill / Primary-ownership review</h3>
          <p>
            KSBs where teaching evidence exists across multiple systems/blocks,
            but the one-Primary model has no single defensible owner:{" "}
            <strong>{snapshot.distributedSkillCount}</strong>. These are{" "}
            <strong>not</strong> “no teaching” gaps and remain publication-blocking
            without an approved Primary.
          </p>
          {snapshot.distributedSkillReviews.length > 0 ? (
            <div className={styles.coverageGapGroups}>
              {snapshot.distributedSkillReviews.map((review) => (
                <details
                  key={review.ksbCode}
                  className={styles.coverageGapGroup}
                  open
                >
                  <summary>
                    <span>{review.title}</span>
                    <span className={styles.checklistCount}>1</span>
                  </summary>
                  <p>{review.reason}</p>
                  <div className={styles.coverageChips}>
                    <span
                      className={styles.coverageChip}
                      data-state="unresolved"
                      title={review.classification}
                    >
                      {review.ksbCode}
                    </span>
                  </div>
                  <p className={styles.coverageMeta}>
                    Evidence across blocks (review):{" "}
                    {review.evidenceExistsAcrossBlocks
                      .map((n) => `B${n}`)
                      .join(", ")}
                  </p>
                  <p className={styles.coverageMeta}>{review.statusNote}</p>
                </details>
              ))}
            </div>
          ) : (
            <p className={styles.coverageEmpty}>
              No distributed-skill ownership reviews attached to this programme
              version.
            </p>
          )}
        </article>

        <article className={styles.coverageLayer} data-layer="proposed">
          <h3>Proposed amendments</h3>
          <p>
            Advisory future curriculum changes only. These{" "}
            <strong>must not</strong> be treated as approved coverage until a
            human approves SOW changes and persists Primaries.
          </p>
          {snapshot.reviewedRegister ? (
            <ul className={styles.coverageProposedList}>
              {snapshot.reviewedRegister.groups.map((group) => (
                <li key={`prop-${group.groupId}`}>
                  <strong>{group.ksbs.join(", ")}</strong>
                  {" → proposed B"}
                  {group.proposedAmendment.proposedPrimaryBlock}
                  {group.proposedAmendment.amendSessionWeek != null
                    ? ` (W${String(group.proposedAmendment.amendSessionWeek).padStart(2, "0")})`
                    : ""}
                  <span className={styles.coverageProposedTag}>
                    {group.proposedAmendment.status}
                  </span>
                  <span className={styles.coverageMeta}>
                    {group.proposedAmendment.note}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.coverageEmpty}>
              No proposed amendments recorded for this version.
            </p>
          )}
        </article>

        <CurriculumAnalysisPanel programmeVersionId={programmeVersionId} />

        <article className={styles.coverageLayer} data-layer="unresolved">
          <h3>Not yet resolved / reviewed</h3>
          <p>
            Official KSBs without an approved Primary that are{" "}
            <strong>not</strong> in the reviewed curriculum-gap register and{" "}
            <strong>not</strong> in distributed-skill ownership review:{" "}
            <strong>{snapshot.notYetResolvedCount}</strong>.
          </p>
          {snapshot.notYetResolvedCodes.length > 0 ? (
            <div className={styles.coverageChips}>
              {snapshot.notYetResolvedCodes.map((code) => (
                <span
                  key={code}
                  className={styles.coverageChip}
                  data-state="unresolved"
                >
                  {code}
                </span>
              ))}
            </div>
          ) : (
            <p className={styles.coverageEmpty}>
              Every official KSB is classified as approved Primary, reviewed gap,
              or distributed-skill ownership review.
            </p>
          )}
        </article>
      </div>

      {!structureLocked && onOpenSpineBuilder ? (
        <button
          type="button"
          className={styles.checklistCta}
          onClick={onOpenSpineBuilder}
        >
          Open Spine Builder
        </button>
      ) : null}
    </section>
  );
}
