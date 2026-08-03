"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  COURSE_STANDARD_CODES,
  CURRENT_STANDARD_VERSION,
  LEGACY_STANDARD_VERSION,
  standardLabel,
  type StandardCode,
} from "@/features/administration/domain/cohort-products";
import { groupsPackId } from "@/features/apprentice-portal/domain/cea/packs";
import { resolveBlockPack } from "@/features/programme-delivery/domain/gta-block-shells";
import {
  addBlockTask,
  authoredTaskFormBadge,
  ensureAuthoredTaskForm,
  getAuthoredTaskForm,
  getCourseBuilderServerSnapshot,
  getCourseBuilderSnapshot,
  hasAuthoredTaskForm,
  listBlockTaskDraftsForBlock,
  listEditableBlockPacks,
  listEditableGroupsPacks,
  removeBlockTask,
  resolveEditableBlockPack,
  resolveEditableGroupsPack,
  saveAuthoredTaskForm,
  seedAutocareGroupsFormsIfNeeded,
  subscribeCourseBuilder,
  updateBlockHeading,
  updateBlockTask,
  updateGroupTaskTitle,
  updateGroupTitle,
} from "@/features/programme-delivery/domain/course-builder-store";
import type { PracticalTaskKind } from "@/features/programme-delivery/domain/task-schema";
import { taskKindLabel } from "@/features/programme-delivery/domain/task-schema";
import { TaskFormBuilder } from "@/features/programme-delivery/components/TaskFormBuilder";
import { Select } from "@/components/ui/Select";
import styles from "@/features/administration/screens/admin-pages.module.css";

type SpineTab = "groups" | "blocks";

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

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join("\n");
}

export function CourseBuilderScreen() {
  const snapshot = useCourseBuilder();
  const [standardCode, setStandardCode] = useState<StandardCode>("ST0499");
  const [spine, setSpine] = useState<SpineTab>("groups");
  const [version, setVersion] = useState(CURRENT_STANDARD_VERSION.ST0499);
  const [expandedBlockId, setExpandedBlockId] = useState<number | null>(1);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftScenario, setDraftScenario] = useState("");
  const [draftKind, setDraftKind] = useState<PracticalTaskKind>("practical");
  const [draftObjectives, setDraftObjectives] = useState("");
  const [draftInstructions, setDraftInstructions] = useState("");
  const [draftQuestions, setDraftQuestions] = useState("");
  const [draftMinutes, setDraftMinutes] = useState("60");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [groupTaskEditor, setGroupTaskEditor] = useState<{
    packId: string;
    taskId: string;
    title: string;
  } | null>(null);

  const versionOptions = useMemo(() => {
    const versions = [
      LEGACY_STANDARD_VERSION[standardCode],
      CURRENT_STANDARD_VERSION[standardCode],
    ];
    return [...new Set(versions)].map((v) => ({
      value: v,
      label:
        v === CURRENT_STANDARD_VERSION[standardCode]
          ? `v${v} · current`
          : `v${v} · legacy`,
    }));
  }, [standardCode]);

  const groupsPackIdResolved =
    spine === "groups" ? groupsPackId(standardCode, version) : "";
  const groupsPack =
    spine === "groups" && groupsPackIdResolved
      ? resolveEditableGroupsPack(groupsPackIdResolved, snapshot)
      : null;

  useEffect(() => {
    if (spine !== "groups" || !groupsPackIdResolved) return;
    seedAutocareGroupsFormsIfNeeded(groupsPackIdResolved);
  }, [spine, groupsPackIdResolved]);

  const blockPack =
    spine === "blocks"
      ? resolveEditableBlockPack(
          resolveBlockPack(standardCode, CURRENT_STANDARD_VERSION[standardCode])
            ?.id ?? "",
          snapshot,
        )
      : null;

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

  function startEditTask(
    packId: string,
    blockId: number,
    taskId: string,
  ) {
    const draft = listBlockTaskDraftsForBlock(packId, blockId).find(
      (t) => t.id === taskId,
    );
    if (!draft) return;
    ensureAuthoredTaskForm(packId, taskId, draft.title);
    setExpandedBlockId(blockId);
    setEditingTaskId(draft.id);
    setDraftTitle(draft.title);
    setDraftScenario(draft.scenario);
    setDraftKind(draft.kind);
    setDraftObjectives(listToLines(draft.objectives));
    setDraftInstructions(listToLines(draft.instructions));
    setDraftQuestions(listToLines(draft.knowledgeQuestions));
    setDraftMinutes(String(draft.estimatedMinutes || 60));
  }

  function saveTaskForBlock(packId: string, blockId: number) {
    if (!draftTitle.trim()) return;
    const minutes = Number(draftMinutes) || 60;
    if (editingTaskId) {
      updateBlockTask(packId, editingTaskId, {
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
        packId,
        blockId,
        title: draftTitle.trim(),
        scenario: draftScenario.trim(),
        kind: draftKind,
        objectives: linesToList(draftObjectives),
        instructions: linesToList(draftInstructions),
        knowledgeQuestions: linesToList(draftQuestions),
        estimatedMinutes: minutes,
      });
      if (created) {
        ensureAuthoredTaskForm(packId, created.id, created.title);
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
      description="Build and edit course packs by Skills England version. Current groups and GTA blocks share the newest version. KSBs are left blank for Jon to map."
    >
      <div className={styles.stack}>
        <div className={styles.panel}>
          <p className={styles.panelLead}>
            <strong>KSBs — pending Jon.</strong> Do not invent KSB mappings here.
            Author tasks apprentices will complete; Jon maps KSBs later.
          </p>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.field}>
            <span>Programme / standard</span>
            <Select
              value={standardCode}
              onChange={(next) => {
                const code = next as StandardCode;
                setStandardCode(code);
                // Blocks always use the newest Skills England version for that standard.
                setVersion(CURRENT_STANDARD_VERSION[code]);
                resetDraftForm();
              }}
              options={COURSE_STANDARD_CODES.map((code) => ({
                value: code,
                label: `${standardLabel(code)} (${code})`,
              }))}
            />
          </label>

          <div className={styles.tabRow} role="tablist" aria-label="Spine">
            <button
              type="button"
              className={spine === "groups" ? styles.tabActive : styles.tab}
              onClick={() => {
                setSpine("groups");
                resetDraftForm();
              }}
            >
              Groups
            </button>
            <button
              type="button"
              className={spine === "blocks" ? styles.tabActive : styles.tab}
              onClick={() => {
                setSpine("blocks");
                setVersion(CURRENT_STANDARD_VERSION[standardCode]);
                resetDraftForm();
              }}
            >
              Block
            </button>
          </div>
        </div>

        {spine === "groups" ? (
          <label className={styles.field}>
            <span>Skills England version</span>
            <Select
              value={version}
              onChange={setVersion}
              options={versionOptions}
            />
          </label>
        ) : (
          <p className={styles.muted}>
            Block pack is locked to newest version{" "}
            <strong>v{CURRENT_STANDARD_VERSION[standardCode]}</strong> (same as
            current groups).
          </p>
        )}

        {spine === "groups" && groupsPack ? (
          <section className={styles.stack}>
            <h2 className={styles.panelTitle}>
              {groupsPack.title} · v{groupsPack.version}
            </h2>
            <p className={styles.muted}>
              {groupsPack.groups.length} groups ·{" "}
              {groupsPack.gatewayItems.length} gateway items · milestones include
              Gateway 1 / Gateway 2 / EPA. Open any task to build the learner form
              with drag-and-drop modules and preview.
            </p>

            {groupTaskEditor && groupTaskEditor.packId === groupsPack.id ? (
              <div className={styles.panel}>
                <TaskFormBuilder
                  value={getAuthoredTaskForm(
                    groupTaskEditor.packId,
                    groupTaskEditor.taskId,
                    groupTaskEditor.title,
                    snapshot,
                  )}
                  onChange={(next) => {
                    saveAuthoredTaskForm(
                      groupTaskEditor.packId,
                      groupTaskEditor.taskId,
                      next,
                    );
                    if (next.title.trim() !== groupTaskEditor.title) {
                      const group = groupsPack.groups.find((g) =>
                        g.tasks.some((t) => t.id === groupTaskEditor.taskId),
                      );
                      if (group) {
                        updateGroupTaskTitle(
                          groupsPack.id,
                          group.id,
                          groupTaskEditor.taskId,
                          next.title.trim(),
                        );
                        setGroupTaskEditor({
                          ...groupTaskEditor,
                          title: next.title.trim(),
                        });
                      }
                    }
                  }}
                  onClose={() => setGroupTaskEditor(null)}
                />
              </div>
            ) : null}

            {groupsPack.groups.map((group) => (
              <div key={group.id} className={styles.panel}>
                <label className={styles.field}>
                  <span>
                    Group {group.number} title · {group.yearLabel} ·{" "}
                    {group.phaseLabel}
                  </span>
                  <input
                    value={group.title}
                    onChange={(e) =>
                      updateGroupTitle(
                        groupsPack.id,
                        group.id,
                        e.target.value,
                      )
                    }
                  />
                </label>
                <div className={styles.stack}>
                  {group.tasks.map((task) => (
                    <div key={task.id} className={styles.stack}>
                      <label className={styles.field}>
                        <span>Task {task.number}</span>
                        <input
                          value={task.title}
                          onChange={(e) =>
                            updateGroupTaskTitle(
                              groupsPack.id,
                              group.id,
                              task.id,
                              e.target.value,
                            )
                          }
                        />
                      </label>
                      <div className={styles.tabRow}>
                        <button
                          type="button"
                          className={
                            groupTaskEditor?.taskId === task.id
                              ? styles.tabActive
                              : styles.tab
                          }
                          onClick={() => {
                            ensureAuthoredTaskForm(
                              groupsPack.id,
                              task.id,
                              task.title,
                            );
                            setGroupTaskEditor({
                              packId: groupsPack.id,
                              taskId: task.id,
                              title: task.title,
                            });
                          }}
                        >
                          {hasAuthoredTaskForm(groupsPack.id, task.id, snapshot)
                            ? "Edit learner form"
                            : "Build learner form"}
                        </button>
                        {(() => {
                          const badge = authoredTaskFormBadge(
                            groupsPack.id,
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
                    </div>
                  ))}
                  {group.tasks.length === 0 ? (
                    <p className={styles.muted}>No tasks in this group yet.</p>
                  ) : null}
                </div>
              </div>
            ))}
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Milestones & gateways</h3>
              <ul>
                {groupsPack.milestones.map((m) => (
                  <li key={m.id}>
                    <strong>{m.title}</strong> — {m.phaseLabel}
                    {m.description ? ` · ${m.description}` : ""}
                  </li>
                ))}
              </ul>
              {groupsPack.gatewayItems.length > 0 ? (
                <ul>
                  {groupsPack.gatewayItems.map((g) => (
                    <li key={g.id}>
                      {g.code}: {g.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ) : null}

        {spine === "blocks" && blockPack ? (
          <section className={styles.stack}>
            <h2 className={styles.panelTitle}>{blockPack.title}</h2>
            <p className={styles.muted}>
              Rename block headings, then add the tasks apprentices will
              complete. Each task builds a portal form (brief, assessment
              record, work notes, optional knowledge questions, sign-off). No
              KSBs.
            </p>
            {blockPack.blocks.map((block) => {
              const tasks = listBlockTaskDraftsForBlock(
                blockPack.id,
                block.id,
                snapshot,
              );
              const isOpen = expandedBlockId === block.id;
              return (
                <div key={block.id} className={styles.panel}>
                  <label className={styles.field}>
                    <span>
                      Block {block.id}
                      {block.kind === "pre_epa"
                        ? " · Pre-EPA"
                        : block.kind === "epa"
                          ? " · EPA"
                          : " · Training"}
                    </span>
                    <input
                      value={block.name}
                      onChange={(e) =>
                        updateBlockHeading(
                          blockPack.id,
                          block.id,
                          e.target.value,
                        )
                      }
                    />
                  </label>

                  <div className={styles.toolbar}>
                    <p className={styles.muted}>
                      {tasks.length} task{tasks.length === 1 ? "" : "s"}
                    </p>
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

                  {tasks.length > 0 ? (
                    <ul>
                      {tasks.map((task) => (
                        <li key={task.id}>
                          <strong>
                            Task {task.taskNumber}: {task.title}
                          </strong>{" "}
                          · {taskKindLabel(task.kind)} · {task.estimatedMinutes}
                          m
                          <div className={styles.tabRow}>
                            <button
                              type="button"
                              className={styles.tab}
                              onClick={() =>
                                startEditTask(
                                  blockPack.id,
                                  block.id,
                                  task.id,
                                )
                              }
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
                                removeBlockTask(blockPack.id, task.id)
                              }
                            >
                              Remove
                            </button>
                            {(() => {
                              const badge = authoredTaskFormBadge(
                                blockPack.id,
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
                          : `Add task to Block ${block.id}`}
                      </h3>
                      <label className={styles.field}>
                        <span>
                          Title <em className={styles.fieldRequired}>required</em>
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
                          onClick={() =>
                            saveTaskForBlock(blockPack.id, block.id)
                          }
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
                              blockPack.id,
                              editingTaskId,
                              draftTitle || "Task",
                              snapshot,
                            )}
                            objectives={linesToList(draftObjectives)}
                            instructions={linesToList(draftInstructions)}
                            estimatedMinutes={Number(draftMinutes) || 60}
                            onChange={(next) => {
                              saveAuthoredTaskForm(
                                blockPack.id,
                                editingTaskId,
                                next,
                              );
                              if (next.title.trim()) {
                                setDraftTitle(next.title);
                                updateBlockTask(blockPack.id, editingTaskId, {
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

        {spine === "groups" && !groupsPack ? (
          <p className={styles.muted}>No groups pack for this selection.</p>
        ) : null}
        {spine === "blocks" && !blockPack ? (
          <p className={styles.muted}>No blocks pack for this standard.</p>
        ) : null}

        <details className={styles.panel}>
          <summary>All seeded packs (debug)</summary>
          <p className={styles.muted}>
            Groups: {listEditableGroupsPacks(snapshot).length} · Blocks:{" "}
            {listEditableBlockPacks(snapshot).length}
          </p>
        </details>
      </div>
    </ApprenticePageShell>
  );
}
