"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import adminStyles from "@/features/administration/screens/admin-pages.module.css";
import type { SpineItem } from "../domain/types";
import type { ProgrammeSessionRecord } from "../domain/programme-sessions";
import type { GtaCourseTaskRecord } from "@/features/programme-delivery/domain/gta-course-tasks";
import {
  TASK_SESSION_LINK_TYPES,
  type TaskSessionLinkRecord,
  type TaskSessionLinkType,
} from "@/features/programme-delivery/domain/task-session-links";
import {
  previewTaskAvailability,
  type PreviewBlockMeta,
  type TaskAvailabilityPreviewRow,
} from "@/features/programme-delivery/domain/task-availability-preview";
import styles from "./programme-builder.module.css";

type Props = {
  programmeVersionId: string;
  spineItems: SpineItem[];
};

type TabId = "sessions" | "links" | "preview";

function weekStartOf(item: SpineItem): number | null {
  const raw = item.metadata?.weekStart;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return null;
}

function blockOrdinalOf(item: SpineItem): number {
  const raw = item.metadata?.blockNumber;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return item.sequence;
}

export function SessionPlannerPanel({
  programmeVersionId,
  spineItems,
}: Props) {
  const [tab, setTab] = useState<TabId>("sessions");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ProgrammeSessionRecord[]>([]);
  const [tasks, setTasks] = useState<GtaCourseTaskRecord[]>([]);
  const [links, setLinks] = useState<TaskSessionLinkRecord[]>([]);

  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [linkTaskId, setLinkTaskId] = useState("");
  const [linkSessionId, setLinkSessionId] = useState("");
  const [linkType, setLinkType] =
    useState<TaskSessionLinkType>("earliest_available_after");
  const [savingLink, setSavingLink] = useState(false);

  const [sampleWeek, setSampleWeek] = useState(5);
  const [manualBlockIds, setManualBlockIds] = useState<string[]>([]);
  const [manualTaskIds, setManualTaskIds] = useState<string[]>([]);
  const [heldTaskIds, setHeldTaskIds] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, tasksRes, linksRes] = await Promise.all([
        fetch(
          `/api/management/programme-definition/sessions?programmeVersionId=${encodeURIComponent(programmeVersionId)}`,
        ),
        fetch(
          `/api/management/course-builder/tasks?programmeVersionId=${encodeURIComponent(programmeVersionId)}`,
        ),
        fetch(
          `/api/management/course-builder/task-session-links?programmeVersionId=${encodeURIComponent(programmeVersionId)}`,
        ),
      ]);
      const sessionsJson = (await sessionsRes.json()) as {
        ok: boolean;
        error?: string;
        sessions?: ProgrammeSessionRecord[];
      };
      const tasksJson = (await tasksRes.json()) as {
        ok: boolean;
        error?: string;
        tasks?: GtaCourseTaskRecord[];
      };
      const linksJson = (await linksRes.json()) as {
        ok: boolean;
        error?: string;
        links?: TaskSessionLinkRecord[];
      };
      if (!sessionsJson.ok) {
        throw new Error(sessionsJson.error || "Failed to load sessions.");
      }
      if (!tasksJson.ok) {
        throw new Error(tasksJson.error || "Failed to load tasks.");
      }
      if (!linksJson.ok) {
        throw new Error(linksJson.error || "Failed to load links.");
      }
      const nextSessions = sessionsJson.sessions ?? [];
      const nextTasks = tasksJson.tasks ?? [];
      setSessions(nextSessions);
      setTasks(nextTasks);
      setLinks(linksJson.links ?? []);
      setLinkTaskId((prev) => prev || nextTasks[0]?.id || "");
      setLinkSessionId((prev) => prev || nextSessions[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [programmeVersionId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const blockSpineItems = useMemo(
    () => spineItems.filter((s) => s.itemType === "block"),
    [spineItems],
  );

  const sessionsView = useMemo(() => {
    if (filterBlock === "all") return sessions;
    return sessions.filter((s) => s.spineItemId === filterBlock);
  }, [sessions, filterBlock]);

  const previewBlocks: PreviewBlockMeta[] = useMemo(
    () =>
      blockSpineItems.map((b) => ({
        spineItemId: b.id,
        blockOrdinal: blockOrdinalOf(b),
        weekStart: weekStartOf(b),
        title: b.title,
      })),
    [blockSpineItems],
  );

  const previewRows: TaskAvailabilityPreviewRow[] = useMemo(
    () =>
      previewTaskAvailability({
        programmeWeek: sampleWeek,
        blocks: previewBlocks,
        sessions,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          taskNumber: t.taskNumber,
          blockOrdinal: t.blockOrdinal,
          spineItemId: t.spineItemId,
          publishStatus: t.publishStatus,
          releaseMode: "session",
        })),
        links,
        manuallyUnlockedBlockIds: manualBlockIds,
        manuallyReleasedTaskIds: manualTaskIds,
        heldTaskIds,
      }),
    [
      sampleWeek,
      previewBlocks,
      sessions,
      tasks,
      links,
      manualBlockIds,
      manualTaskIds,
      heldTaskIds,
    ],
  );

  async function addLink() {
    if (!linkTaskId || !linkSessionId || !linkType) return;
    setSavingLink(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/management/course-builder/task-session-links",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programmeVersionId,
            links: [
              {
                taskId: linkTaskId,
                sessionId: linkSessionId,
                linkType,
              },
            ],
          }),
        },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Save failed.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingLink(false);
    }
  }

  async function removeLink(link: TaskSessionLinkRecord) {
    setSavingLink(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        programmeVersionId,
        taskId: link.taskId,
        sessionId: link.sessionId,
        linkType: link.linkType,
      });
      const res = await fetch(
        `/api/management/course-builder/task-session-links?${qs}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error || "Delete failed.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSavingLink(false);
    }
  }

  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  const sessionById = useMemo(
    () => new Map(sessions.map((s) => [s.id, s])),
    [sessions],
  );
  const taskById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  );

  return (
    <section
      className={`${styles.panel} ${styles.span2}`}
      aria-label="Sessions and task availability"
    >
      <div className={styles.panelHead}>
        <h2>Sessions / Task links (S8 gate)</h2>
        <button
          type="button"
          className={adminStyles.secondaryBtn}
          onClick={() => void loadAll()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <p className={styles.coverageIntro}>
        Controlled planned sessions for this programme version. Tasks stay under
        blocks; optional session links drive availability preview (S1–S3). This
        is not Golden B, Primaries, or learner form content.
      </p>

      {error ? (
        <div className={styles.banner} data-tone="error" role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.coverageMetrics}>
        <div>
          <span>Planned sessions</span>
          <strong>{sessions.length}</strong>
        </div>
        <div>
          <span>Course tasks</span>
          <strong>{tasks.length}</strong>
        </div>
        <div>
          <span>Task↔session links</span>
          <strong>{links.length}</strong>
        </div>
      </div>

      <div className={styles.spineActions} style={{ marginBottom: "0.75rem" }}>
        {(
          [
            ["sessions", "Session browser"],
            ["links", "Task↔session links"],
            ["preview", "Availability preview"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              tab === id ? adminStyles.primaryBtn : adminStyles.secondaryBtn
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sessions" ? (
        <div>
          <label className={styles.meta}>
            Filter by block{" "}
            <select
              value={filterBlock}
              onChange={(e) => setFilterBlock(e.target.value)}
            >
              <option value="all">All blocks</option>
              {blockSpineItems.map((b) => (
                <option key={b.id} value={b.id}>
                  B{blockOrdinalOf(b)} · {b.title}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.spineTableWrap} style={{ marginTop: "0.75rem" }}>
            <table className={styles.spineTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Key</th>
                  <th>Week</th>
                  <th>In-week</th>
                  <th>FS</th>
                  <th>Title</th>
                </tr>
              </thead>
              <tbody>
                {sessionsView.map((s) => (
                  <tr key={s.id}>
                    <td>{s.sequence}</td>
                    <td>{s.sessionKey}</td>
                    <td>{s.calendarWeek}</td>
                    <td>{s.sessionIndexInWeek}</td>
                    <td>{s.foundationSkillCode ?? "—"}</td>
                    <td>{s.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessionsView.length === 0 ? (
              <p className={styles.meta}>No sessions for this filter.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "links" ? (
        <div>
          <div className={styles.startLayout}>
            <label className={styles.meta}>
              Task
              <select
                value={linkTaskId}
                onChange={(e) => setLinkTaskId(e.target.value)}
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    B{t.blockOrdinal} T{t.taskNumber} · {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.meta}>
              Session
              <select
                value={linkSessionId}
                onChange={(e) => setLinkSessionId(e.target.value)}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionKey} · W{s.calendarWeek}
                    {s.sessionIndexInWeek > 1
                      ? `.${s.sessionIndexInWeek}`
                      : ""}{" "}
                    · {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.meta}>
              Link type
              <select
                value={linkType}
                onChange={(e) =>
                  setLinkType(e.target.value as TaskSessionLinkType)
                }
              >
                {TASK_SESSION_LINK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.startActions}>
            <button
              type="button"
              className={adminStyles.primaryBtn}
              disabled={savingLink || !tasks.length || !sessions.length}
              onClick={() => void addLink()}
            >
              {savingLink ? "Saving…" : "Add / upsert link"}
            </button>
          </div>
          <div className={styles.spineTableWrap} style={{ marginTop: "0.75rem" }}>
            <table className={styles.spineTable}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Session</th>
                  <th>Type</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const task = taskById.get(link.taskId);
                  const session = sessionById.get(link.sessionId);
                  return (
                    <tr key={link.id}>
                      <td>
                        {task
                          ? `B${task.blockOrdinal} T${task.taskNumber} · ${task.title}`
                          : link.taskId}
                      </td>
                      <td>
                        {session
                          ? `${session.sessionKey} (W${session.calendarWeek})`
                          : link.sessionId}
                      </td>
                      <td>{link.linkType}</td>
                      <td>
                        <button
                          type="button"
                          className={adminStyles.secondaryBtn}
                          disabled={savingLink}
                          onClick={() => void removeLink(link)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {links.length === 0 ? (
              <p className={styles.meta}>
                No links yet. Soft delivery bands stay unauthored (S7) until you
                add earliest_available_after rows.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "preview" ? (
        <div>
          <p className={styles.meta}>
            Sample apprentice programme week. Block open = calendar/sequence
            reach or authorised override (S4). Tasks: Available / Coming up /
            Not available (S5). Preview only — not live learner unlock.
          </p>
          <label className={styles.meta}>
            Sample programme week{" "}
            <input
              type="number"
              min={1}
              max={120}
              value={sampleWeek}
              onChange={(e) => setSampleWeek(Number(e.target.value) || 1)}
            />
          </label>

          <div className={styles.coverageIntegrity} style={{ marginTop: "0.75rem" }}>
            <span>
              <strong>Override unlock blocks</strong>
            </span>
            {blockSpineItems.map((b) => (
              <label key={b.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={manualBlockIds.includes(b.id)}
                  onChange={() =>
                    setManualBlockIds((prev) => toggleId(prev, b.id))
                  }
                />
                B{blockOrdinalOf(b)} · {b.title}
              </label>
            ))}
          </div>

          <div className={styles.coverageIntegrity}>
            <span>
              <strong>Force-release tasks</strong>
            </span>
            {tasks.slice(0, 15).map((t) => (
              <label key={t.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={manualTaskIds.includes(t.id)}
                  onChange={() =>
                    setManualTaskIds((prev) => toggleId(prev, t.id))
                  }
                />
                B{t.blockOrdinal} T{t.taskNumber}
              </label>
            ))}
            {tasks.length > 15 ? (
              <span className={styles.meta}>
                Showing first 15 tasks for override checkboxes.
              </span>
            ) : null}
          </div>

          <div className={styles.coverageIntegrity}>
            <span>
              <strong>Hold back tasks</strong>
            </span>
            {tasks.slice(0, 15).map((t) => (
              <label key={`h-${t.id}`} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={heldTaskIds.includes(t.id)}
                  onChange={() =>
                    setHeldTaskIds((prev) => toggleId(prev, t.id))
                  }
                />
                B{t.blockOrdinal} T{t.taskNumber}
              </label>
            ))}
          </div>

          <div className={styles.spineTableWrap} style={{ marginTop: "0.75rem" }}>
            <table className={styles.spineTable}>
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Openable</th>
                  <th>Publish</th>
                  <th>Reasons</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.taskId}>
                    <td>B{row.blockOrdinal}</td>
                    <td>
                      T{row.taskNumber} · {row.title}
                    </td>
                    <td>{row.status}</td>
                    <td>{row.openable ? "yes" : "no"}</td>
                    <td>{row.publishStatus}</td>
                    <td className={styles.meta}>{row.reasons.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.length === 0 ? (
              <p className={styles.meta}>No tasks on this version yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
