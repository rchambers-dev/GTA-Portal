"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  getProgrammeDefinitionServerSnapshot,
  getProgrammeDefinitionSnapshot,
  selectProgramme,
  subscribeProgrammeDefinition,
  clearProgrammeDefinitionPreview,
} from "@/features/programme-definition/domain/programme-definition-store";
import type {
  GtaProgrammeVersion,
  SpineItem,
} from "@/features/programme-definition/domain/types";
import {
  addBlockTask,
  authoredTaskFormBadge,
  clearCourseBuilderLocalCache,
  ensureAuthoredTaskForm,
  getAuthoredTaskForm,
  getCourseBuilderServerSnapshot,
  getCourseBuilderSnapshot,
  listBlockTaskDraftsForBlock,
  loadSharedCourseTasks,
  removeBlockTask,
  saveAuthoredTaskForm,
  subscribeCourseBuilder,
  updateBlockTask,
} from "@/features/programme-delivery/domain/course-builder-store";
import type { PracticalTaskKind } from "@/features/programme-delivery/domain/task-schema";
import { taskKindLabel } from "@/features/programme-delivery/domain/task-schema";
import { TaskFormBuilder } from "@/features/programme-delivery/components/TaskFormBuilder";
import { Select } from "@/components/ui/Select";
import styles from "@/features/administration/screens/admin-pages.module.css";

const KIND_OPTIONS: Array<{ value: PracticalTaskKind; label: string }> = [
  { value: "practical", label: taskKindLabel("practical") },
  { value: "reflection", label: taskKindLabel("reflection") },
  { value: "knowledge_test", label: taskKindLabel("knowledge_test") },
  { value: "job_card", label: taskKindLabel("job_card") },
];

function useCourseBuilder() {
  return useSyncExternalStore(
    subscribeCourseBuilder,
    getCourseBuilderSnapshot,
    getCourseBuilderServerSnapshot,
  );
}

function useProgrammeDefinition() {
  return useSyncExternalStore(
    subscribeProgrammeDefinition,
    getProgrammeDefinitionSnapshot,
    getProgrammeDefinitionServerSnapshot,
  );
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join("\n");
}

function blockOrdinal(item: SpineItem): number {
  const n = item.metadata?.blockNumber;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  return Math.max(1, item.sequence);
}

function programmeOptionLabel(p: GtaProgrammeVersion): string {
  return `${p.programmeTitle} · GTA v${p.internalVersion} · ${p.status}`;
}

export function CourseBuilderScreen() {
  const snapshot = useCourseBuilder();
  const programmeState = useProgrammeDefinition();
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftScenario, setDraftScenario] = useState("");
  const [draftKind, setDraftKind] = useState<PracticalTaskKind>("practical");
  const [draftObjectives, setDraftObjectives] = useState("");
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftQuestions, setDraftQuestions] = useState("");
  const [draftMinutes, setDraftMinutes] = useState("60");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const programmes = useMemo(
    () =>
      programmeState.programmes
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [programmeState.programmes],
  );

  const programmeId =
    programmeState.selectedProgrammeId &&
    programmes.some((p) => p.id === programmeState.selectedProgrammeId)
      ? programmeState.selectedProgrammeId
      : "";

  const programme = programmes.find((p) => p.id === programmeId) ?? null;

  useEffect(() => {
    if (!programme?.id) return;
    void loadSharedCourseTasks(programme.id).catch(() => {
      /* local cache remains if DB hydrate fails */
    });
  }, [programme?.id]);

  const official = programme
    ? programmeState.officialVersions.find(
        (v) => v.id === programme.standardVersionId,
      ) ??
      programmeState.officialVersions.find(
        (v) =>
          v.standardCode.toUpperCase() ===
            programme.standardCode.toUpperCase() &&
          v.externalVersion === programme.externalVersion,
      ) ??
      null
    : null;

  const blocks = useMemo(
    () =>
      (programme?.spineItems ?? [])
        .filter((i) => i.itemType === "block")
        .slice()
        .sort((a, b) => a.sequence - b.sequence),
    [programme?.spineItems],
  );

  function resetDraftForm() {
    setDraftTitle("");
    setDraftScenario("");
    setDraftKind("practical");
    setDraftObjectives("");
    setDraftInstructions("");
    setDraftQuestions("");
    setDraftMinutes("60");
    setEditingTaskId(null);
  }

  function onClearLocalCache() {
    const ok = window.confirm(
      "Clear local builder cache on this browser?\n\n" +
        "This removes locally cached GTA programmes and Course Builder task drafts from this device only.\n\n" +
        "It does NOT delete anything from the database. Staff accounts and Skills England official packs are untouched.",
    );
    if (!ok) return;
    clearProgrammeDefinitionPreview();
    clearCourseBuilderLocalCache();
    setExpandedBlockId(null);
    resetDraftForm();
  }

  function startEditTask(spineBlockId: string, taskId: string) {
    if (!programme) return;
    const draft = listBlockTaskDraftsForBlock(
      programme.id,
      spineBlockId,
      snapshot,
    ).find((t) => t.id === taskId);
    if (!draft) return;
    ensureAuthoredTaskForm(programme.id, taskId, draft.title);
    setExpandedBlockId(spineBlockId);
    setEditingTaskId(draft.id);
    setDraftTitle(draft.title);
    setDraftScenario(draft.scenario);
    setDraftKind(draft.kind);
    setDraftObjectives(listToLines(draft.objectives));
    setDraftInstructions(listToLines(draft.instructions));
    setDraftQuestions(listToLines(draft.knowledgeQuestions));
    setDraftMinutes(String(draft.estimatedMinutes || 60));
  }

  function saveTaskForBlock(block: SpineItem) {
    if (!programme || !draftTitle.trim()) return;
    const minutes = Number(draftMinutes) || 60;
    if (editingTaskId) {
      updateBlockTask(programme.id, editingTaskId, {
        title: draftTitle.trim(),
        scenario: draftScenario.trim(),
        kind: draftKind,
        objectives: linesToList(draftObjectives),
        instructions: linesToList(draftInstructions),
        knowledgeQuestions: linesToList(draftQuestions),
        estimatedMinutes: minutes,
      });
    } else {
      const created = addBlockTask({
        programmeVersionId: programme.id,
        spineBlockId: block.id,
        blockOrdinal: blockOrdinal(block),
        title: draftTitle.trim(),
        scenario: draftScenario.trim(),
        kind: draftKind,
        objectives: linesToList(draftObjectives),
        instructions: linesToList(draftInstructions),
        knowledgeQuestions: linesToList(draftQuestions),
        estimatedMinutes: minutes,
      });
      if (created) {
        ensureAuthoredTaskForm(programme.id, created.id, created.title);
        setEditingTaskId(created.id);
        setDraftTitle(created.title);
        setDraftScenario(created.scenario);
        setDraftKind(created.kind);
        setDraftObjectives(listToLines(created.objectives));
        setDraftInstructions(listToLines(created.instructions));
        setDraftQuestions(listToLines(created.knowledgeQuestions));
        setDraftMinutes(String(created.estimatedMinutes || 60));
        return;
      }
    }
    resetDraftForm();
  }

  return (
    <ApprenticePageShell
      eyebrow="Management"
      title="Course Builder"
      description="Author apprentice tasks on blocks from a selected GTA programme version. Structure and KSBs stay in Programme Builder / Spine Builder."
      actions={
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClearLocalCache}
            title="Clears browser localStorage for Programme Builder and Course Builder only"
          >
            Clear local cache
          </button>
          <Link
            href="/management/programme-builder"
            className={styles.secondaryBtn}
          >
            Programme Builder
          </Link>
        </div>
      }
    >
      <div className={styles.stack}>
        <div className={styles.panel}>
          <p className={styles.panelLead}>
            <strong>KSBs — pending Jon.</strong> Do not invent KSB mappings here.
            Author tasks apprentices will complete; curriculum ownership lives on
            the programme version.
          </p>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.field} style={{ minWidth: "22rem" }}>
            <span>Programme version</span>
            <Select
              value={programmeId}
              onChange={(next) => {
                selectProgramme(next || null);
                setExpandedBlockId(null);
                resetDraftForm();
              }}
              options={
                programmes.length === 0
                  ? [{ value: "", label: "No GTA programmes yet…" }]
                  : [
                      { value: "", label: "Select programme version…" },
                      ...programmes.map((p) => ({
                        value: p.id,
                        label: programmeOptionLabel(p),
                      })),
                    ]
              }
            />
          </label>
        </div>

        {programme ? (
          <div className={styles.panel}>
            <p className={styles.muted}>
              <strong>Official standard (read-only)</strong>
              <br />
              {programme.standardCode}
              {official?.title ? ` · ${official.title}` : ""} · Skills England v
              {programme.externalVersion || official?.externalVersion || "—"}
            </p>
            <p className={styles.muted}>
              Switch Skills England pack via Programme Builder (new GTA version /
              fork). Course Builder does not re-bind SE underneath this version.
            </p>
            <p className={styles.muted}>
              <Link href="/management/programme-builder">
                Open Programme Builder
              </Link>
              {" · "}
              Spine Builder is inside Programme Builder (Structure → Spine).
            </p>
          </div>
        ) : programmes.length === 0 ? (
          <p className={styles.muted}>
            Create a GTA programme in Programme Builder first, then return here to
            author block tasks.
          </p>
        ) : (
          <p className={styles.muted}>
            Select a GTA programme version to author block tasks. Blocks come from
            that version&apos;s spine — Course Builder does not pick one for you.
          </p>
        )}

        {programme && blocks.length === 0 ? (
          <p className={styles.muted}>
            This programme version has no training blocks yet. Add blocks in Spine
            Builder.
          </p>
        ) : null}

        {programme && blocks.length > 0 ? (
          <section className={styles.stack}>
            <h2 className={styles.panelTitle}>
              {programme.programmeTitle} · blocks
            </h2>
            <p className={styles.muted}>
              Block titles come from the programme spine (read-only here). Add
              apprentice tasks and build each learner form. No KSBs.
            </p>
            {blocks.map((block) => {
              const tasks = listBlockTaskDraftsForBlock(
                programme.id,
                block.id,
                snapshot,
              );
              const isOpen = expandedBlockId === block.id;
              const ordinal = blockOrdinal(block);
              return (
                <div key={block.id} className={styles.panel}>
                  <div className={styles.toolbar}>
                    <div>
                      <h3 className={styles.panelTitle}>
                        Block {ordinal} · {block.title}
                      </h3>
                      <p className={styles.muted}>
                        {block.plannedOtjHours > 0
                          ? `${block.plannedOtjHours} hrs planned OTJ · `
                          : ""}
                        Sequence {block.sequence}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={isOpen ? styles.tabActive : styles.tab}
                      onClick={() => {
                        setExpandedBlockId(isOpen ? null : block.id);
                        if (!isOpen) resetDraftForm();
                      }}
                    >
                      {isOpen ? "Close task editor" : "Create / edit tasks"}
                    </button>
                  </div>

                  <p className={styles.muted}>
                    {tasks.length} task{tasks.length === 1 ? "" : "s"}
                  </p>

                  {tasks.length > 0 ? (
                    <ul>
                      {tasks.map((task) => (
                        <li key={task.id}>
                          <strong>
                            Task {task.taskNumber}: {task.title}
                          </strong>{" "}
                          · {taskKindLabel(task.kind)} · {task.estimatedMinutes}m
                          <div className={styles.tabRow}>
                            <button
                              type="button"
                              className={styles.tab}
                              onClick={() => startEditTask(block.id, task.id)}
                            >
                              Edit
                            </button>
                            <Link
                              className={styles.tab}
                              href={`/apprentice/tracking/${task.id}`}
                            >
                              Preview as apprentice
                            </Link>
                            <button
                              type="button"
                              className={styles.tabAmber}
                              onClick={() =>
                                removeBlockTask(programme.id, task.id)
                              }
                            >
                              Remove
                            </button>
                            {(() => {
                              const badge = authoredTaskFormBadge(
                                programme.id,
                                task.id,
                                snapshot,
                              );
                              return (
                                <ApprenticeStatusChip tone={badge.tone}>
                                  {badge.label}
                                </ApprenticeStatusChip>
                              );
                            })()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.muted}>
                      No apprentice tasks in this block yet.
                    </p>
                  )}

                  {isOpen ? (
                    <div className={styles.stack}>
                      <h3 className={styles.panelTitle}>
                        {editingTaskId
                          ? "Edit task"
                          : `Add task to Block ${ordinal}`}
                      </h3>
                      <label className={styles.field}>
                        <span>
                          Title{" "}
                          <em className={styles.fieldRequired}>required</em>
                        </span>
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          placeholder="e.g. Carry out a vehicle safety inspection"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Task type</span>
                        <Select
                          value={draftKind}
                          onChange={(next) =>
                            setDraftKind(next as PracticalTaskKind)
                          }
                          options={KIND_OPTIONS}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Scenario / brief for the apprentice</span>
                        <textarea
                          value={draftScenario}
                          onChange={(e) => setDraftScenario(e.target.value)}
                          rows={3}
                          placeholder="What should the apprentice do and why?"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Objectives (one per line)</span>
                        <textarea
                          value={draftObjectives}
                          onChange={(e) => setDraftObjectives(e.target.value)}
                          rows={3}
                          placeholder={"Complete the inspection\nRecord findings"}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Instructions (one per line)</span>
                        <textarea
                          value={draftInstructions}
                          onChange={(e) => setDraftInstructions(e.target.value)}
                          rows={3}
                          placeholder={"Wear PPE\nFollow workshop procedure"}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Knowledge questions (one per line, optional)</span>
                        <textarea
                          value={draftQuestions}
                          onChange={(e) => setDraftQuestions(e.target.value)}
                          rows={3}
                          placeholder="Why is isolation important on hybrid vehicles?"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Estimated minutes</span>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={draftMinutes}
                          onChange={(e) => setDraftMinutes(e.target.value)}
                        />
                      </label>
                      <div className={styles.tabRow}>
                        <button
                          type="button"
                          className={styles.tabActive}
                          onClick={() => saveTaskForBlock(block)}
                          disabled={!draftTitle.trim()}
                        >
                          {editingTaskId ? "Save changes" : "Add task"}
                        </button>
                        {editingTaskId ? (
                          <button
                            type="button"
                            className={styles.tab}
                            onClick={resetDraftForm}
                          >
                            Cancel edit
                          </button>
                        ) : null}
                      </div>

                      {editingTaskId ? (
                        <div className={styles.panel}>
                          <h4 className={styles.panelTitle}>
                            Learner form modules
                          </h4>
                          <TaskFormBuilder
                            value={getAuthoredTaskForm(
                              programme.id,
                              editingTaskId,
                              draftTitle || "Task",
                              snapshot,
                            )}
                            objectives={linesToList(draftObjectives)}
                            instructions={linesToList(draftInstructions)}
                            estimatedMinutes={Number(draftMinutes) || 60}
                            onChange={(next) => {
                              saveAuthoredTaskForm(
                                programme.id,
                                editingTaskId,
                                next,
                              );
                              if (next.title.trim()) {
                                setDraftTitle(next.title);
                                updateBlockTask(programme.id, editingTaskId, {
                                  title: next.title.trim(),
                                  scenario: next.scenario,
                                });
                              }
                            }}
                            onClose={() => resetDraftForm()}
                          />
                        </div>
                      ) : (
                        <p className={styles.muted}>
                          Add the task first, then build its drag-and-drop learner
                          form.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}
      </div>
    </ApprenticePageShell>
  );
}
