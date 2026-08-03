"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskBlockType } from "@/features/programme-delivery/domain/task-schema";
import {
  FORM_MODULE_PALETTE,
  canAddModuleType,
  createModuleFromPalette,
  insertModuleKeepingDifficultyLast,
  isSingleInstanceModuleType,
  moduleConfigFieldCaption,
  moduleLabelPlaceholder,
  moduleOptionsCaption,
  moduleRequiredCaption,
  moveModule,
  type AuthoredTaskForm,
  type FormModule,
} from "@/features/programme-delivery/domain/form-modules";
import { ApprenticeStatusChip } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { LearnerTaskPreviewOverlay } from "@/features/programme-delivery/components/LearnerTaskPreviewOverlay";
import styles from "./TaskFormBuilder.module.css";
import adminStyles from "@/features/administration/screens/admin-pages.module.css";

type Mode = "edit" | "preview";

type DragPayload =
  | { kind: "palette"; type: TaskBlockType }
  | { kind: "reorder"; index: number };

type Props = {
  value: AuthoredTaskForm;
  onChange: (next: AuthoredTaskForm) => void;
  onClose?: () => void;
  /** Shown in the full apprentice preview (block drafts). */
  objectives?: string[];
  instructions?: string[];
  estimatedMinutes?: number;
};

const PALETTE_MIME = "application/x-form-module";
const REORDER_MIME = "application/x-form-reorder";

function paletteLabel(type: TaskBlockType): string {
  return FORM_MODULE_PALETTE.find((p) => p.type === type)?.label ?? type;
}

function DropZone({
  active,
  dragging,
  label,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  active: boolean;
  dragging: boolean;
  label: string;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`${styles.dropZone}${dragging ? ` ${styles.dropZoneDragging}` : ""}${active ? ` ${styles.dropZoneActive}` : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={label}
    >
      <span className={styles.dropZoneLabel}>{label}</span>
    </div>
  );
}

function OptionsBulletEditor({
  type,
  options,
  onChange,
}: {
  type: TaskBlockType;
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const rows = options.length > 0 ? options : [""];

  return (
    <div className={styles.optionsEditor}>
      <span className={styles.optionsEditorLabel}>
        {moduleOptionsCaption(type)}
      </span>
      <ul className={styles.optionsBulletList}>
        {rows.map((opt, index) => (
          <li key={index} className={styles.optionsBulletRow}>
            <span className={styles.optionsBullet} aria-hidden>
              •
            </span>
            <input
              className={styles.optionsBulletInput}
              value={opt}
              placeholder={`Choice ${index + 1}`}
              aria-label={`Choice ${index + 1}`}
              onChange={(e) => {
                const next = [...rows];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className={styles.optionsBulletRemove}
              disabled={rows.length <= 1}
              onClick={() =>
                onChange(rows.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.optionsAddBtn}
        onClick={() => onChange([...rows, ""])}
      >
        + Add choice
      </button>
    </div>
  );
}

function PaletteScrollList({
  usedTypes,
  onAdd,
  onDragStartType,
  onDragEnd,
}: {
  usedTypes: Set<TaskBlockType>;
  onAdd: (type: TaskBlockType) => void;
  onDragStartType: (type: TaskBlockType) => void;
  onDragEnd: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  function updateScrollHints() {
    const el = listRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const overflow = maxScroll > 4;
    setCanScrollUp(overflow && el.scrollTop > 4);
    setCanScrollDown(overflow && el.scrollTop < maxScroll - 4);
  }

  useEffect(() => {
    updateScrollHints();
    const el = listRef.current;
    if (!el) return;
    const onResize = () => updateScrollHints();
    window.addEventListener("resize", onResize);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onResize)
        : null;
    observer?.observe(el);
    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className={styles.paletteScrollWrap}>
      <div
        className={`${styles.paletteListShell}${
          canScrollUp ? ` ${styles.paletteListShellTop}` : ""
        }${canScrollDown ? ` ${styles.paletteListShellBottom}` : ""}`}
      >
        <div
          ref={listRef}
          className={styles.paletteList}
          onScroll={updateScrollHints}
          tabIndex={0}
          aria-label="Building blocks list — scroll for more"
        >
          {FORM_MODULE_PALETTE.map((item) => {
            const alreadyOnForm =
              isSingleInstanceModuleType(item.type) && usedTypes.has(item.type);
            return (
              <button
                key={item.type}
                type="button"
                className={`${styles.paletteItem}${
                  alreadyOnForm ? ` ${styles.paletteItemUsed}` : ""
                }`}
                draggable={!alreadyOnForm}
                disabled={alreadyOnForm}
                title={
                  alreadyOnForm
                    ? "Already on this form — remove it first to add again"
                    : undefined
                }
                onDragStart={(e) => {
                  if (alreadyOnForm) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData(PALETTE_MIME, item.type);
                  e.dataTransfer.effectAllowed = "copy";
                  onDragStartType(item.type);
                }}
                onDragEnd={onDragEnd}
                onClick={() => {
                  if (alreadyOnForm) return;
                  onAdd(item.type);
                }}
              >
                <strong>{item.label}</strong>
                <span>
                  {alreadyOnForm
                    ? "Already on this form (only one allowed)"
                    : item.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {canScrollDown ? (
        <p className={styles.paletteScrollCue} aria-hidden>
          ↓ Scroll for more blocks
        </p>
      ) : null}
    </div>
  );
}

export function TaskFormBuilder({
  value,
  onChange,
  onClose,
  objectives,
  instructions,
  estimatedMinutes,
}: Props) {
  const [mode, setMode] = useState<Mode>("edit");
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    value.modules[0]?.id ?? null,
  );
  const isReady = value.status === "ready";

  /** Content edits always keep the form Pending until staff mark it complete. */
  function commitDraft(next: AuthoredTaskForm) {
    onChange({ ...next, status: "pending" });
  }

  function patchForm(patch: Partial<AuthoredTaskForm>) {
    commitDraft({ ...value, ...patch });
  }

  function markFormComplete() {
    onChange({ ...value, status: "ready" });
    onClose?.();
  }

  function markFormPending() {
    onChange({ ...value, status: "pending" });
  }

  function patchModule(id: string, patch: Partial<FormModule>) {
    const target = value.modules.find((m) => m.id === id);
    if (!target) return;
    if (target.locked) {
      if (patch.locked !== false) return;
      commitDraft({
        ...value,
        modules: value.modules.map((m) =>
          m.id === id ? { ...m, locked: false } : m,
        ),
      });
      return;
    }
    commitDraft({
      ...value,
      modules: value.modules.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    });
  }

  function addFromPalette(type: TaskBlockType, atIndex?: number) {
    if (!canAddModuleType(value.modules, type)) return;
    const item = FORM_MODULE_PALETTE.find((p) => p.type === type);
    if (!item) return;
    const next = createModuleFromPalette(item);
    const modules = insertModuleKeepingDifficultyLast(
      value.modules,
      next,
      atIndex,
    );
    commitDraft({ ...value, modules });
    setSelectedId(next.id);
    setMode("edit");
  }

  function removeModule(id: string) {
    const target = value.modules.find((m) => m.id === id);
    if (target?.locked) return;
    const modules = value.modules.filter((m) => m.id !== id);
    commitDraft({ ...value, modules });
    if (selectedId === id) setSelectedId(modules[0]?.id ?? null);
  }

  function handleDropAt(index: number, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const paletteType = e.dataTransfer.getData(PALETTE_MIME) as TaskBlockType;
    const reorderRaw = e.dataTransfer.getData(REORDER_MIME);
    if (paletteType) {
      if (!canAddModuleType(value.modules, paletteType)) {
        setDragging(null);
        setActiveDropIndex(null);
        return;
      }
      addFromPalette(paletteType, index);
    } else if (reorderRaw !== "") {
      const fromIndex = Number(reorderRaw);
      if (!Number.isNaN(fromIndex)) {
        commitDraft({
          ...value,
          modules: moveModule(value.modules, fromIndex, index),
        });
      }
    } else if (dragging?.kind === "palette") {
      if (!canAddModuleType(value.modules, dragging.type)) {
        setDragging(null);
        setActiveDropIndex(null);
        return;
      }
      addFromPalette(dragging.type, index);
    } else if (dragging?.kind === "reorder") {
      commitDraft({
        ...value,
        modules: moveModule(value.modules, dragging.index, index),
      });
    }
    setDragging(null);
    setActiveDropIndex(null);
  }

  function armDropZone(index: number, e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragging?.kind === "reorder" ? "move" : "copy";
    setActiveDropIndex(index);
  }

  const dropCount = value.modules.length + 1;
  const isDragging = dragging !== null;
  const usedModuleTypes = new Set(value.modules.map((m) => m.type));

  return (
    <div className={styles.builder}>
      <div className={styles.howTo}>
        <strong>How to build this learner form</strong>
        <ol>
          <li>Set the task title and scenario so apprentices know the job.</li>
          <li>
            Drag building blocks from the left onto the striped drop zones (or
            click to add).
          </li>
          <li>
            Press Edit wording on a block, set the question or text apprentices
            will see, then Lock it when finished.
          </li>
          <li>
            Use Preview as apprentice for a full-screen check of the finished
            form.
          </li>
          <li>
            When the form is finished, press <strong>Mark form ready</strong> —
            it closes so you can open the next task. Until then it stays
            Pending.
          </li>
        </ol>
      </div>

      <div className={styles.modeRow}>
        <button
          type="button"
          className={mode === "edit" ? adminStyles.tabActive : adminStyles.tab}
          onClick={() => setMode("edit")}
        >
          Build form
        </button>
        <button
          type="button"
          className={
            mode === "preview" ? adminStyles.tabActive : adminStyles.tab
          }
          onClick={() => setMode("preview")}
        >
          Preview as apprentice
        </button>
        {onClose ? (
          <button type="button" className={adminStyles.tab} onClick={onClose}>
            Close editor
          </button>
        ) : null}
      </div>

      <div className={styles.metaGrid}>
        <label className={styles.fieldLabel}>
          Task title (apprentice page heading)
          <input
            value={value.title}
            onChange={(e) => patchForm({ title: e.target.value })}
            placeholder="e.g. Practical — replace front brake pads"
          />
        </label>
        <label className={styles.fieldLabel}>
          Scenario (job brief apprentices read first)
          <textarea
            rows={3}
            value={value.scenario}
            onChange={(e) => patchForm({ scenario: e.target.value })}
            placeholder="e.g. You are working on a customer vehicle. Follow the job card, work safely, and record what you found and what you did."
          />
        </label>
      </div>

      {mode === "preview" ? (
        <LearnerTaskPreviewOverlay
          form={value}
          objectives={objectives}
          instructions={instructions}
          estimatedMinutes={estimatedMinutes}
          onClose={() => setMode("edit")}
        />
      ) : null}

      <div className={styles.layout}>
          <aside className={styles.palette}>
            <span className={styles.stepBadge}>Step 1 · Choose blocks</span>
            <h3 className={styles.paletteTitle}>Building blocks</h3>
            <p className={styles.paletteHint}>
              Drag a block onto a striped drop zone — or click it to add. Some
              blocks can only be used once (they grey out when already on the
              form). Scroll for every block type.
            </p>
            <PaletteScrollList
              usedTypes={usedModuleTypes}
              onAdd={addFromPalette}
              onDragStartType={(type) =>
                setDragging({ kind: "palette", type })
              }
              onDragEnd={() => {
                setDragging(null);
                setActiveDropIndex(null);
              }}
            />
          </aside>

          <div
            className={`${styles.canvas}${isDragging ? ` ${styles.canvasDragging}` : ""}`}
          >
            <span className={styles.stepBadge}>Step 2 · Arrange & edit</span>
            <h3 className={styles.canvasTitle}>Learner form</h3>
            <p className={styles.paletteHint}>
              Striped boxes are drop zones. After adding a block, press Edit
              wording, set the apprentice-facing text, then Lock.
            </p>

            {Array.from({ length: dropCount }, (_, dropIndex) => (
              <div key={`slot-${dropIndex}`} className={styles.slotStack}>
                <DropZone
                  active={isDragging && activeDropIndex === dropIndex}
                  dragging={isDragging}
                  label={
                    dropIndex === 0
                      ? "Drop here — start of form"
                      : dropIndex === value.modules.length
                        ? "Drop here — end of form"
                        : "Drop here — between blocks"
                  }
                  onDragOver={(e) => armDropZone(dropIndex, e)}
                  onDragLeave={() => {
                    setActiveDropIndex((current) =>
                      current === dropIndex ? null : current,
                    );
                  }}
                  onDrop={(e) => handleDropAt(dropIndex, e)}
                />
                {dropIndex < value.modules.length ? (
                  <div
                    className={`${styles.moduleCard}${
                      value.modules[dropIndex].locked
                        ? ` ${styles.moduleCardLocked}`
                        : ""
                    }${
                      dragging?.kind === "reorder" &&
                      dragging.index === dropIndex
                        ? ` ${styles.moduleCardDragging}`
                        : ""
                    }`}
                    draggable={!value.modules[dropIndex].locked}
                    onDragStart={(e) => {
                      if (value.modules[dropIndex].locked) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData(REORDER_MIME, String(dropIndex));
                      e.dataTransfer.effectAllowed = "move";
                      setDragging({ kind: "reorder", index: dropIndex });
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setActiveDropIndex(null);
                    }}
                  >
                    <div className={styles.moduleHeader}>
                      <span className={styles.moduleType}>
                        {paletteLabel(value.modules[dropIndex].type)}
                        {value.modules[dropIndex].locked ? " · Locked" : ""}
                      </span>
                      <div className={styles.moduleActions}>
                        <button
                          type="button"
                          className={
                            value.modules[dropIndex].locked
                              ? styles.lockBtnOn
                              : styles.lockBtn
                          }
                          onClick={() =>
                            patchModule(value.modules[dropIndex].id, {
                              locked: !value.modules[dropIndex].locked,
                            })
                          }
                        >
                          {value.modules[dropIndex].locked
                            ? "Unlock"
                            : "Lock"}
                        </button>
                        <button
                          type="button"
                          className={styles.ghostBtn}
                          disabled={Boolean(value.modules[dropIndex].locked)}
                          onClick={() =>
                            setSelectedId(value.modules[dropIndex].id)
                          }
                        >
                          {selectedId === value.modules[dropIndex].id
                            ? "Editing"
                            : "Edit wording"}
                        </button>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          disabled={Boolean(value.modules[dropIndex].locked)}
                          onClick={() =>
                            removeModule(value.modules[dropIndex].id)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className={styles.dragHandleRow}>
                      <span className={styles.dragHandle} aria-hidden>
                        ⋮⋮
                      </span>
                      <strong>{value.modules[dropIndex].label}</strong>
                    </div>
                    {selectedId === value.modules[dropIndex].id &&
                    !value.modules[dropIndex].locked ? (
                      <div className={styles.metaGrid}>
                        <label className={styles.fieldLabel}>
                          {moduleConfigFieldCaption(
                            value.modules[dropIndex].type,
                          )}
                          <input
                            value={value.modules[dropIndex].label}
                            placeholder={moduleLabelPlaceholder(
                              value.modules[dropIndex].type,
                            )}
                            onChange={(e) =>
                              patchModule(value.modules[dropIndex].id, {
                                label: e.target.value,
                              })
                            }
                          />
                        </label>
                        {value.modules[dropIndex].type === "checkbox_group" ||
                        value.modules[dropIndex].type === "radio_group" ||
                        value.modules[dropIndex].type ===
                          "difficulty_feedback" ? (
                          <OptionsBulletEditor
                            type={value.modules[dropIndex].type}
                            options={value.modules[dropIndex].options ?? []}
                            onChange={(next) =>
                              patchModule(value.modules[dropIndex].id, {
                                options: next,
                              })
                            }
                          />
                        ) : null}
                        {value.modules[dropIndex].type === "rating_rows" ||
                        value.modules[dropIndex].type === "action_rows" ||
                        value.modules[dropIndex].type === "parts_rows" ? (
                          <label className={styles.fieldLabel}>
                            Number of rows on the form
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={value.modules[dropIndex].rowCount ?? 3}
                              placeholder="e.g. 3"
                              onChange={(e) =>
                                patchModule(value.modules[dropIndex].id, {
                                  rowCount: Number(e.target.value) || 3,
                                })
                              }
                            />
                          </label>
                        ) : null}
                        {value.modules[dropIndex].type === "sign_off" ? (
                          <label className={styles.fieldLabel}>
                            Who must sign this?
                            <select
                              value={
                                value.modules[dropIndex].signOffRole ??
                                "apprentice"
                              }
                              onChange={(e) =>
                                patchModule(value.modules[dropIndex].id, {
                                  signOffRole: e.target
                                    .value as FormModule["signOffRole"],
                                })
                              }
                            >
                              <option value="apprentice">Apprentice</option>
                              <option value="mentor">Mentor</option>
                              <option value="trainer">Trainer</option>
                              <option value="assessor">Assessor</option>
                            </select>
                          </label>
                        ) : null}
                        {value.modules[dropIndex].type !== "heading" &&
                        value.modules[dropIndex].type !== "description" ? (
                          <label className={styles.previewOption}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                value.modules[dropIndex].required,
                              )}
                              onChange={(e) =>
                                patchModule(value.modules[dropIndex].id, {
                                  required: e.target.checked,
                                })
                              }
                            />
                            {moduleRequiredCaption(
                              value.modules[dropIndex].type,
                            )}
                          </label>
                        ) : (
                          <p className={styles.lockedHint}>
                            {moduleRequiredCaption(
                              value.modules[dropIndex].type,
                            )}
                          </p>
                        )}
                      </div>
                    ) : null}
                    {selectedId === value.modules[dropIndex].id &&
                    value.modules[dropIndex].locked ? (
                      <p className={styles.lockedHint}>
                        Locked — unlock to change wording or move this block.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

      <div className={styles.statusRow}>
        <ApprenticeStatusChip tone={isReady ? "green" : "amber"}>
          {isReady ? "Form ready" : "Pending"}
        </ApprenticeStatusChip>
        {isReady ? (
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={markFormPending}
          >
            Re-open for editing
          </button>
        ) : (
          <button
            type="button"
            className={styles.completeBtn}
            onClick={markFormComplete}
          >
            Mark form ready
          </button>
        )}
        <span className={styles.statusHint}>
          {isReady
            ? "Ready for use. Any edit will move it back to Pending."
            : "Changes save as you go. Mark ready to finish and close this form."}
        </span>
      </div>
    </div>
  );
}
