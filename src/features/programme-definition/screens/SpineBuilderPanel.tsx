"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BlockKsbMapping,
  ImportedKsb,
  LearningIntent,
  SpineItem,
  SpineItemType,
} from "../domain/types";
import { LEARNING_INTENT_LABELS, LEARNING_INTENTS } from "../domain/types";
import {
  createBlockKsbMapping,
  findMapping,
  mappingsForBlock,
  primaryMappingForKsb,
  removeBlockKsbMapping,
  removeMappingsForBlock,
  updateBlockKsbMapping,
} from "../domain/block-ksb-mappings";
import {
  recommendLearningIntent,
  type IntentRecommendation,
} from "../domain/ksb-intent-recommender";
import {
  SPINE_STRUCTURE_PALETTE,
  createSpineItemFromType,
  insertSpineItemAt,
  ksbByCode,
  labelSpineType,
  moveSpineItem,
  removeSpineItem,
  updateSpineItemFields,
} from "../domain/spine-builder";
import { KSB_INTENT_RECOMMENDATION_FEATURE } from "../domain/types";
import styles from "./SpineBuilderPanel.module.css";

const STRUCTURE_MIME = "application/x-spine-structure";
const REORDER_MIME = "application/x-spine-reorder";
const KSB_MIME = "application/x-spine-ksb";

type DragPayload =
  | { kind: "structure"; type: SpineItemType }
  | { kind: "reorder"; index: number }
  | { kind: "ksb"; code: string };

type AssignDraft = {
  blockId: string;
  ksbCode: string;
  /** Existing mapping id when editing. */
  mappingId?: string;
  isPrimary: boolean;
  learningIntent: LearningIntent;
};

type Props = {
  items: SpineItem[];
  ksbMappings: BlockKsbMapping[];
  ksbs: ImportedKsb[];
  actor?: string;
  onChange: (next: {
    spineItems: SpineItem[];
    ksbMappings: BlockKsbMapping[];
  }) => void;
  hoursDeficit?: number | null;
  minimumComplianceHours?: number | null;
  structurePlannedOtjHours?: number;
};

export function SpineBuilderPanel({
  items,
  ksbMappings,
  ksbs,
  actor = "staff",
  onChange,
  hoursDeficit = null,
  minimumComplianceHours = null,
  structurePlannedOtjHours = 0,
}: Props) {
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [ksbDropBlockId, setKsbDropBlockId] = useState<string | null>(null);
  const [ksbFilter, setKsbFilter] = useState<
    "all" | "knowledge" | "skill" | "behaviour"
  >("all");
  const [assignDraft, setAssignDraft] = useState<AssignDraft | null>(null);
  const [recommendation, setRecommendation] =
    useState<IntentRecommendation | null>(null);
  const [recommendBusy, setRecommendBusy] = useState(false);
  const ksbListRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => items.slice().sort((a, b) => a.sequence - b.sequence),
    [items],
  );

  const filteredKsbs = useMemo(
    () =>
      ksbs.filter((k) => ksbFilter === "all" || k.type === ksbFilter),
    [ksbs, ksbFilter],
  );

  useEffect(() => {
    const el = ksbListRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollHeight <= el.clientHeight + 1) return;

      const delta = e.deltaY;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop >= maxScroll - 1;

      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      el.scrollTop = Math.min(maxScroll, Math.max(0, el.scrollTop + delta));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [filteredKsbs.length]);

  useEffect(() => {
    if (!assignDraft) {
      setRecommendation(null);
      return;
    }

    const ksb = ksbByCode(ksbs, assignDraft.ksbCode);
    const block = sorted.find((i) => i.id === assignDraft.blockId);
    if (!ksb || !block) return;

    const primary = primaryMappingForKsb(ksbMappings, assignDraft.ksbCode);
    const hasPrimaryElsewhere = Boolean(
      primary && primary.blockId !== assignDraft.blockId,
    );
    const primaryBlockTitle = primary
      ? sorted.find((i) => i.id === primary.blockId)?.title ?? null
      : null;

    let cancelled = false;
    setRecommendBusy(true);
    void recommendLearningIntent({
      ksb,
      block,
      spineItems: sorted,
      existingMappings: ksbMappings.filter(
        (m) => m.id !== assignDraft.mappingId,
      ),
      hasPrimaryElsewhere,
      primaryBlockTitle,
    }).then((rec) => {
      if (cancelled) return;
      setRecommendation(rec);
      setRecommendBusy(false);
      setAssignDraft((d) =>
        d && !d.mappingId
          ? { ...d, learningIntent: rec.intent }
          : d,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    assignDraft?.blockId,
    assignDraft?.ksbCode,
    assignDraft?.mappingId,
    ksbs,
    sorted,
    ksbMappings,
  ]);

  function commit(nextItems: SpineItem[], nextMappings: BlockKsbMapping[]) {
    onChange({ spineItems: nextItems, ksbMappings: nextMappings });
  }

  function openAssign(blockId: string, code: string) {
    const existing = findMapping(ksbMappings, blockId, code);
    const primary = primaryMappingForKsb(ksbMappings, code);
    setAssignDraft({
      blockId,
      ksbCode: code.toUpperCase(),
      mappingId: existing?.id,
      isPrimary: existing?.isPrimary ?? false,
      learningIntent: existing?.learningIntent ?? "practise",
    });
    void primary;
  }

  function onDropAt(index: number, e: React.DragEvent) {
    e.preventDefault();
    setActiveDropIndex(null);

    const structureType = e.dataTransfer.getData(STRUCTURE_MIME) as SpineItemType;
    const reorderRaw = e.dataTransfer.getData(REORDER_MIME);

    if (structureType && SPINE_STRUCTURE_PALETTE.some((p) => p.type === structureType)) {
      const created = createSpineItemFromType(structureType, index + 1);
      commit(insertSpineItemAt(sorted, created, index), ksbMappings);
      setDragging(null);
      return;
    }

    if (reorderRaw !== "") {
      const fromIndex = Number(reorderRaw);
      if (Number.isFinite(fromIndex)) {
        commit(moveSpineItem(sorted, fromIndex, index), ksbMappings);
      }
    }
    setDragging(null);
  }

  function onDropKsbOnBlock(blockId: string, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setKsbDropBlockId(null);
    const code = e.dataTransfer.getData(KSB_MIME);
    if (!code) return;
    openAssign(blockId, code);
    setDragging(null);
  }

  function confirmAssign() {
    if (!assignDraft) return;
    const { blockId, ksbCode, mappingId, learningIntent } = assignDraft;
    const primary = primaryMappingForKsb(ksbMappings, ksbCode);
    const primaryOnOtherBlock = Boolean(
      primary && primary.blockId !== blockId,
    );
    // New mapping cannot steal primary unless staff is editing; forced false.
    const isPrimary =
      !mappingId && primaryOnOtherBlock ? false : assignDraft.isPrimary;
    const acceptedRecommended = Boolean(
      recommendation && learningIntent === recommendation.intent,
    );
    const mappingSource = acceptedRecommended ? "ai_suggested" : "manual";
    const provenance = recommendation
      ? {
          recommendationProvider:
            recommendation.source === "ai"
              ? ("portal_ai" as const)
              : ("heuristic" as const),
          recommendationFeature: KSB_INTENT_RECOMMENDATION_FEATURE,
          recommendedIntent: recommendation.intent,
          recommendationAccepted: acceptedRecommended,
          confidence: recommendation.confidence,
          aiReasonSummary: recommendation.reasonSummary,
        }
      : {
          recommendationProvider: null,
          recommendationFeature: null,
          recommendedIntent: null,
          recommendationAccepted: null,
          confidence: null,
          aiReasonSummary: null,
        };

    let next: BlockKsbMapping[];
    if (mappingId) {
      next = updateBlockKsbMapping(ksbMappings, mappingId, {
        isPrimary,
        learningIntent,
        mappingSource,
        ...provenance,
      });
    } else {
      next = createBlockKsbMapping({
        blockId,
        ksbCode,
        isPrimary,
        learningIntent,
        mappingSource,
        ...provenance,
        createdBy: actor,
        existing: ksbMappings,
        spineItems: sorted,
      });
    }
    commit(sorted, next);
    setAssignDraft(null);
  }

  const primaryForDraft = assignDraft
    ? primaryMappingForKsb(ksbMappings, assignDraft.ksbCode)
    : undefined;
  const primaryElsewhere =
    primaryForDraft &&
    assignDraft &&
    primaryForDraft.blockId !== assignDraft.blockId
      ? primaryForDraft
      : undefined;
  const canOfferPrimary =
    !primaryElsewhere || Boolean(assignDraft?.mappingId);
  const primaryElsewhereTitle = primaryElsewhere
    ? sorted.find((i) => i.id === primaryElsewhere.blockId)?.title
    : null;
  const primaryElsewhereSeq = primaryElsewhere
    ? sorted.find((i) => i.id === primaryElsewhere.blockId)?.sequence
    : null;
  const draftKsb = assignDraft
    ? ksbByCode(ksbs, assignDraft.ksbCode)
    : undefined;
  const draftBlock = assignDraft
    ? sorted.find((i) => i.id === assignDraft.blockId)
    : undefined;

  return (
    <div className={styles.root}>
      <aside className={styles.palette}>
        <h3 className={styles.paletteTitle}>Structure</h3>
        <p className={styles.hint}>
          Drag onto the spine canvas, or click to append.
        </p>
        <div className={styles.paletteList}>
          {SPINE_STRUCTURE_PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              className={styles.paletteItem}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(STRUCTURE_MIME, item.type);
                e.dataTransfer.effectAllowed = "copy";
                setDragging({ kind: "structure", type: item.type });
              }}
              onDragEnd={() => setDragging(null)}
              onClick={() => {
                const created = createSpineItemFromType(
                  item.type,
                  sorted.length + 1,
                );
                commit(
                  insertSpineItemAt(sorted, created, sorted.length),
                  ksbMappings,
                );
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>

        <h3 className={`${styles.paletteTitle} ${styles.ksbHeading}`}>KSBs</h3>
        <p className={styles.hint}>
          Drag a KSB onto a block — confirm primary and LearningIntent.
        </p>
        <div className={styles.filters}>
          {(["all", "knowledge", "skill", "behaviour"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={styles.filterBtn}
              data-active={ksbFilter === f ? "true" : "false"}
              onClick={() => setKsbFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div
          ref={ksbListRef}
          className={styles.ksbPalette}
          tabIndex={0}
          aria-label="Official KSBs — scroll to browse"
        >
          {filteredKsbs.length === 0 ? (
            <p className={styles.hint}>No KSBs imported for this standard.</p>
          ) : (
            filteredKsbs.map((ksb) => (
              <div
                key={ksb.code}
                role="button"
                tabIndex={0}
                className={styles.ksbDrag}
                draggable
                title={ksb.description}
                onDragStart={(e) => {
                  e.dataTransfer.setData(KSB_MIME, ksb.code);
                  e.dataTransfer.effectAllowed = "copy";
                  setDragging({ kind: "ksb", code: ksb.code });
                }}
                onDragEnd={() => setDragging(null)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                }}
              >
                <strong>{ksb.code}</strong>
                <span>{ksb.description}</span>
              </div>
            ))
          )}
        </div>
      </aside>

      <div
        className={`${styles.canvas}${
          dragging && dragging.kind !== "ksb" ? ` ${styles.canvasDragging}` : ""
        }`}
      >
        <h3 className={styles.canvasTitle}>Spine canvas</h3>
        {minimumComplianceHours != null ? (
          <div
            className={`${styles.hoursStrip}${
              hoursDeficit != null && hoursDeficit > 0
                ? ` ${styles.hoursStripDeficit}`
                : hoursDeficit === 0
                  ? ` ${styles.hoursStripOk}`
                  : ""
            }`}
          >
            <span>
              Structured OTJ <strong>{structurePlannedOtjHours} hrs</strong>
            </span>
            <span>
              Min compliance <strong>{minimumComplianceHours} hrs</strong>
            </span>
            <span>
              Deficit{" "}
              <strong>
                {hoursDeficit != null && hoursDeficit > 0
                  ? `${hoursDeficit} hrs short`
                  : "On target"}
              </strong>
            </span>
          </div>
        ) : null}
        <p className={styles.hint}>
          {sorted.length === 0
            ? "Canvas is empty — drag a structure piece into a drop zone or click one in the palette to start."
            : "Drop structure into the large striped zones. Reorder with the handle. Drop KSBs only onto blocks."}
        </p>

        <DropSlot
          active={activeDropIndex === 0}
          dragging={Boolean(dragging && dragging.kind !== "ksb")}
          empty={sorted.length === 0}
          label={
            sorted.length === 0
              ? "Drop Block / Gateway / EPA here"
              : "Drop at start of spine"
          }
          onDragOver={(e) => {
            if (dragging?.kind === "ksb") return;
            e.preventDefault();
            setActiveDropIndex(0);
          }}
          onDragLeave={() => setActiveDropIndex((i) => (i === 0 ? null : i))}
          onDrop={(e) => onDropAt(0, e)}
        />

        {sorted.map((item, index) => {
          const blockMaps =
            item.itemType === "block"
              ? mappingsForBlock(ksbMappings, item.id)
              : [];
          return (
            <div key={item.id} className={styles.canvasItemWrap}>
              <article
                className={`${styles.card}${
                  item.itemType === "block" ? ` ${styles.cardBlock}` : ""
                }${ksbDropBlockId === item.id ? ` ${styles.cardKsbActive}` : ""}`}
                onDragOver={(e) => {
                  if (item.itemType !== "block") return;
                  if (dragging?.kind !== "ksb") return;
                  e.preventDefault();
                  e.stopPropagation();
                  setKsbDropBlockId(item.id);
                }}
                onDragLeave={() =>
                  setKsbDropBlockId((id) => (id === item.id ? null : id))
                }
                onDrop={(e) => {
                  if (item.itemType !== "block") return;
                  onDropKsbOnBlock(item.id, e);
                }}
              >
                <div className={styles.cardTop}>
                  <button
                    type="button"
                    className={styles.dragHandle}
                    draggable
                    aria-label={`Reorder ${item.title}`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(REORDER_MIME, String(index));
                      e.dataTransfer.effectAllowed = "move";
                      setDragging({ kind: "reorder", index });
                    }}
                    onDragEnd={() => setDragging(null)}
                  >
                    ⋮⋮
                  </button>
                  <span className={styles.typeBadge}>{labelSpineType(item)}</span>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => {
                      const nextItems = removeSpineItem(sorted, item.id);
                      const nextMaps =
                        item.itemType === "block"
                          ? removeMappingsForBlock(ksbMappings, item.id)
                          : ksbMappings;
                      commit(nextItems, nextMaps);
                    }}
                  >
                    Remove
                  </button>
                </div>

                <label className={styles.field}>
                  <span>Title</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) =>
                      commit(
                        updateSpineItemFields(sorted, item.id, {
                          title: e.target.value,
                        }),
                        ksbMappings,
                      )
                    }
                  />
                </label>

                <div className={styles.fieldRow}>
                  <label className={styles.field}>
                    <span>Weeks</span>
                    <input
                      type="number"
                      min={0}
                      value={item.plannedWeeks ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const raw = e.target.value;
                        commit(
                          updateSpineItemFields(sorted, item.id, {
                            plannedWeeks:
                              raw === ""
                                ? null
                                : Math.max(0, Number(raw) || 0),
                          }),
                          ksbMappings,
                        );
                      }}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>OTJ hrs</span>
                    <input
                      type="number"
                      min={0}
                      value={item.plannedOtjHours}
                      onChange={(e) =>
                        commit(
                          updateSpineItemFields(sorted, item.id, {
                            plannedOtjHours: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          }),
                          ksbMappings,
                        )
                      }
                    />
                  </label>
                </div>

                {item.itemType === "block" ? (
                  <div className={styles.assigned}>
                    <span className={styles.assignedLabel}>
                      Assigned KSBs ({blockMaps.length})
                      {dragging?.kind === "ksb" ? " · drop here" : ""}
                    </span>
                    {blockMaps.length === 0 ? (
                      <p className={styles.hint}>No KSBs on this block yet.</p>
                    ) : (
                      <div className={styles.assignedPills}>
                        {blockMaps.map((m) => {
                          const ksb = ksbByCode(ksbs, m.ksbCode);
                          return (
                            <span
                              key={m.id}
                              className={`${styles.assignedPill}${
                                m.isPrimary ? ` ${styles.assignedPillPrimary}` : ""
                              }`}
                              title={ksb?.description}
                            >
                              <button
                                type="button"
                                className={styles.pillEdit}
                                onClick={() => openAssign(item.id, m.ksbCode)}
                              >
                                <strong>{m.ksbCode}</strong>
                                <span className={styles.pillIntent}>
                                  · {LEARNING_INTENT_LABELS[m.learningIntent]}
                                </span>
                                {m.isPrimary ? (
                                  <span className={styles.pillPrimaryMark}>
                                    Primary
                                  </span>
                                ) : null}
                              </button>
                              <button
                                type="button"
                                className={styles.pillRemove}
                                aria-label={`Remove ${m.ksbCode}`}
                                onClick={() =>
                                  commit(
                                    sorted,
                                    removeBlockKsbMapping(
                                      ksbMappings,
                                      item.id,
                                      m.ksbCode,
                                    ),
                                  )
                                }
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={styles.hint}>
                    KSBs can only be assigned to blocks.
                  </p>
                )}
              </article>

              <DropSlot
                active={activeDropIndex === index + 1}
                dragging={Boolean(dragging && dragging.kind !== "ksb")}
                label={`Drop after ${item.title}`}
                onDragOver={(e) => {
                  if (dragging?.kind === "ksb") return;
                  e.preventDefault();
                  setActiveDropIndex(index + 1);
                }}
                onDragLeave={() =>
                  setActiveDropIndex((i) => (i === index + 1 ? null : i))
                }
                onDrop={(e) => onDropAt(index + 1, e)}
              />
            </div>
          );
        })}
      </div>

      {assignDraft && draftBlock ? (
        <div
          className={styles.assignBackdrop}
          role="presentation"
          onClick={() => setAssignDraft(null)}
        >
          <div
            className={styles.assignPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-ksb-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="assign-ksb-title">
              Map {assignDraft.ksbCode} → {draftBlock.title}
            </h3>
            {draftKsb ? (
              <p className={styles.hint}>{draftKsb.description}</p>
            ) : null}

            {primaryElsewhere ? (
              <p className={styles.primaryElsewhere}>
                Primary in: Block {primaryElsewhereSeq} —{" "}
                {primaryElsewhereTitle || "Untitled"}
              </p>
            ) : null}
            {canOfferPrimary ? (
              <label className={styles.primaryToggle}>
                <input
                  type="checkbox"
                  checked={assignDraft.isPrimary}
                  onChange={(e) =>
                    setAssignDraft((d) =>
                      d ? { ...d, isPrimary: e.target.checked } : d,
                    )
                  }
                />
                <span>
                  {primaryElsewhere
                    ? "Move Primary to this block"
                    : "Make this the Primary block"}
                </span>
              </label>
            ) : null}

            <fieldset className={styles.intentFieldset}>
              <legend>LearningIntent</legend>
              {recommendBusy ? (
                <p className={styles.hint}>Getting recommendation…</p>
              ) : recommendation ? (
                <p className={styles.recommendBanner}>
                  Recommended:{" "}
                  <strong>
                    {LEARNING_INTENT_LABELS[recommendation.intent]}
                  </strong>{" "}
                  ({Math.round(recommendation.confidence * 100)}%
                  {recommendation.source === "ai" ? " · AI" : " · heuristic"})
                  — {recommendation.reasonSummary}
                </p>
              ) : null}
              <div className={styles.intentList}>
                {LEARNING_INTENTS.map((intent) => {
                  const isRec = recommendation?.intent === intent;
                  return (
                    <label
                      key={intent}
                      className={styles.intentOption}
                      data-selected={
                        assignDraft.learningIntent === intent ? "true" : "false"
                      }
                      data-recommended={isRec ? "true" : "false"}
                    >
                      <input
                        type="radio"
                        name="learning-intent"
                        checked={assignDraft.learningIntent === intent}
                        onChange={() =>
                          setAssignDraft((d) =>
                            d ? { ...d, learningIntent: intent } : d,
                          )
                        }
                      />
                      <span>
                        {LEARNING_INTENT_LABELS[intent]}
                        {isRec ? " · recommended" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className={styles.assignActions}>
              <button
                type="button"
                className={styles.assignCancel}
                onClick={() => setAssignDraft(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.assignConfirm}
                onClick={confirmAssign}
              >
                {assignDraft.mappingId ? "Save mapping" : "Add mapping"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DropSlot({
  active,
  dragging,
  empty = false,
  label,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  active: boolean;
  dragging: boolean;
  empty?: boolean;
  label: string;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`${styles.dropZone}${empty ? ` ${styles.dropZoneEmpty}` : ""}${dragging ? ` ${styles.dropZoneDragging}` : ""}${active ? ` ${styles.dropZoneActive}` : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={label}
    >
      <span className={styles.dropZoneLabel}>
        {active ? "Drop here" : label}
      </span>
    </div>
  );
}
