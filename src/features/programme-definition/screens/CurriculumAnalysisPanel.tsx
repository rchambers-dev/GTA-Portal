"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CurriculumAnalysisResult, CurriculumAnalysisRun } from "../domain/curriculum-analysis";
import styles from "./programme-builder.module.css";

type Props = {
  programmeVersionId: string | null;
};

function groupResults(results: CurriculumAnalysisResult[] | undefined) {
  const list = results ?? [];
  return {
    primary: list.filter((r) => r.classification === "primary_candidate"),
    gaps: list.filter((r) => r.classification === "curriculum_gap"),
    distributed: list.filter((r) => r.classification === "distributed_skill"),
    ambiguous: list.filter((r) => r.classification === "ambiguous"),
  };
}

export function CurriculumAnalysisPanel({ programmeVersionId }: Props) {
  const [runs, setRuns] = useState<CurriculumAnalysisRun[]>([]);
  const [selected, setSelected] = useState<CurriculumAnalysisRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [detailCode, setDetailCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!programmeVersionId) return;
    setError(null);
    const res = await fetch(
      `/api/management/programme-definition/curriculum-analysis?programmeVersionId=${encodeURIComponent(programmeVersionId)}`,
    );
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      runs?: CurriculumAnalysisRun[];
      aiConfigured?: boolean;
    };
    if (!data.ok) {
      setError(data.error || "Failed to load analysis runs.");
      return;
    }
    setAiConfigured(Boolean(data.aiConfigured));
    setRuns(data.runs ?? []);
  }, [programmeVersionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openRun = useCallback(async (runId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/management/programme-definition/curriculum-analysis/${encodeURIComponent(runId)}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        run?: CurriculumAnalysisRun;
      };
      if (!data.ok || !data.run) {
        setError(data.error || "Failed to load run.");
        return;
      }
      setSelected(data.run);
      setDetailCode(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const startRun = useCallback(
    async (providerMode: "heuristic" | "portal_ai") => {
      if (!programmeVersionId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          "/api/management/programme-definition/curriculum-analysis",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              programmeVersionId,
              providerMode,
              createdBy: "programme-builder-ui",
            }),
          },
        );
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          run?: CurriculumAnalysisRun;
        };
        if (!data.ok || !data.run) {
          setError(data.error || "Analysis failed.");
          return;
        }
        await refresh();
        await openRun(data.run.id);
      } finally {
        setBusy(false);
      }
    },
    [openRun, programmeVersionId, refresh],
  );

  const groups = useMemo(
    () => groupResults(selected?.results),
    [selected?.results],
  );
  const detail = selected?.results?.find((r) => r.ksbCode === detailCode) ?? null;

  if (!programmeVersionId) {
    return (
      <article className={styles.coverageLayer} data-layer="ai">
        <h3>AI Analysis</h3>
        <p className={styles.coverageEmpty}>
          Load a programme version to inspect AI curriculum analysis runs.
        </p>
      </article>
    );
  }

  return (
    <article className={styles.coverageLayer} data-layer="ai">
      <h3>AI Analysis</h3>
      <p>
        Recommendations only. AI results{" "}
        <strong>never</strong> count toward approved Primary coverage. Original
        approved curriculum evidence only — proposed amendments excluded.
      </p>

      <div className={styles.coverageIntegrity}>
        <button
          type="button"
          className={styles.checklistCta}
          disabled={busy}
          onClick={() => void startRun("heuristic")}
        >
          Run heuristic analysis
        </button>
        <button
          type="button"
          className={styles.checklistCta}
          disabled={busy || !aiConfigured}
          title={
            aiConfigured
              ? "Live model analysis"
              : "Configure AI_API_KEY / AI_PROVIDER first"
          }
          onClick={() => void startRun("portal_ai")}
        >
          Run portal AI analysis
        </button>
      </div>

      {error ? (
        <div className={styles.coverageBlockedBanner} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.coverageMeta}>
        Latest runs: {runs.length ? "" : "none yet"}
      </div>
      {runs.length > 0 ? (
        <div className={styles.coverageChips}>
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              className={styles.coverageChip}
              data-state={run.id === selected?.id ? "approved" : "unresolved"}
              onClick={() => void openRun(run.id)}
              title={`${run.provider}/${run.model} · ${run.status}`}
            >
              {new Date(run.createdAt).toLocaleString()} · {run.provider} ·{" "}
              {run.status}
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <div className={styles.coverageGapGroups}>
          <p className={styles.coverageMeta}>
            Selected run: {selected.provider}/{selected.model} · prompt{" "}
            {selected.promptVersion} · {selected.status}
            {selected.stats && typeof selected.stats === "object"
              ? ` · ${JSON.stringify(selected.stats)}`
              : ""}
          </p>
          {(
            [
              ["High/medium Primary candidates", groups.primary],
              ["Curriculum gaps", groups.gaps],
              ["Distributed-skill", groups.distributed],
              ["Ambiguous / review", groups.ambiguous],
            ] as const
          ).map(([label, rows]) => (
            <details key={label} className={styles.coverageGapGroup} open>
              <summary>
                <span>{label}</span>
                <span className={styles.checklistCount}>{rows.length}</span>
              </summary>
              <div className={styles.coverageChips}>
                {rows.map((r) => (
                  <button
                    key={r.ksbCode}
                    type="button"
                    className={styles.coverageChip}
                    data-state={
                      r.classification === "primary_candidate"
                        ? "approved"
                        : r.classification === "curriculum_gap"
                          ? "gap"
                          : "unresolved"
                    }
                    onClick={() => setDetailCode(r.ksbCode)}
                  >
                    {r.ksbCode}
                    {r.proposedPrimaryBlockNumber != null
                      ? ` → B${r.proposedPrimaryBlockNumber}`
                      : ""}{" "}
                    · {r.confidence}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : null}

      {detail ? (
        <div className={styles.coverageGapGroup}>
          <h4>
            {detail.ksbCode} · {detail.classification} · {detail.confidence}
          </h4>
          <p>{detail.reasoningSummary}</p>
          {detail.warnings.length ? (
            <ul>
              {detail.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <div className={styles.coverageMeta}>Evidence</div>
          <ul className={styles.coverageProposedList}>
            {detail.evidence.slice(0, 6).map((e) => (
              <li key={`${e.locationRef}-${e.strength}`}>
                <strong>{e.locationRef}</strong> [{e.strength}] B
                {e.blockNumber ?? "?"} W{e.week ?? "?"} — {e.acceptRejectReason}
                <div className={styles.coverageMeta}>{e.excerpt}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
