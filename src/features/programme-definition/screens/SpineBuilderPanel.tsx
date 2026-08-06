"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ImportedKsb, SpineItem, SpineItemType } from "../domain/types";
import {
  SPINE_STRUCTURE_PALETTE,
  assignKsbToBlock,
  createSpineItemFromType,
  insertSpineItemAt,
  ksbByCode,
  labelSpineType,
  moveSpineItem,
  removeKsbFromBlock,
  removeSpineItem,
  updateSpineItemFields,
} from "../domain/spine-builder";
import styles from "./SpineBuilderPanel.module.css";

const STRUCTURE_MIME = "application/x-spine-structure";
const REORDER_MIME = "application/x-spine-reorder";
const KSB_MIME = "application/x-spine-ksb";

type DragPayload =
  | { kind: "structure"; type: SpineItemType }
  | { kind: "reorder"; index: number }
  | { kind: "ksb"; code: string };

type Props = {
  items: SpineItem[];
  ksbs: ImportedKsb[];
  onChange: (next: SpineItem[]) => void;
  hoursDeficit?: number | null;
  minimumComplianceHours?: number | null;
  structurePlannedOtjHours?: number;
};

export function SpineBuilderPanel({
  items,
  ksbs,
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

  // Draggable chips steal wheel events in some browsers — scroll the list ourselves.
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

  function commit(next: SpineItem[]) {
    onChange(next);
  }

  function onDropAt(index: number, e: React.DragEvent) {
    e.preventDefault();
    setActiveDropIndex(null);

    const structureType = e.dataTransfer.getData(STRUCTURE_MIME) as SpineItemType;
    const reorderRaw = e.dataTransfer.getData(REORDER_MIME);

    if (structureType && SPINE_STRUCTURE_PALETTE.some((p) => p.type === structureType)) {
      const created = createSpineItemFromType(structureType, index + 1);
      commit(insertSpineItemAt(sorted, created, index));
      setDragging(null);
      return;
    }

    if (reorderRaw !== "") {
      const fromIndex = Number(reorderRaw);
      if (Number.isFinite(fromIndex)) {
        commit(moveSpineItem(sorted, fromIndex, index));
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
    commit(assignKsbToBlock(sorted, blockId, code));
    setDragging(null);
  }

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
                commit(insertSpineItemAt(sorted, created, sorted.length));
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>

        <h3 className={`${styles.paletteTitle} ${styles.ksbHeading}`}>KSBs</h3>
        <p className={styles.hint}>Drag a KSB onto a block card to assign it.</p>
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

        {sorted.length === 0 ? (
          <div className={styles.emptyCanvas}>
            No blocks, gateways, or EPA yet.
          </div>
        ) : null}
        {sorted.map((item, index) => (
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
                  onClick={() => commit(removeSpineItem(sorted, item.id))}
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
                            raw === "" ? null : Math.max(0, Number(raw) || 0),
                        }),
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
                      )
                    }
                  />
                </label>
              </div>

              {item.itemType === "block" ? (
                <div className={styles.assigned}>
                  <span className={styles.assignedLabel}>
                    Assigned KSBs ({item.assignedKsbCodes.length})
                    {dragging?.kind === "ksb" ? " · drop here" : ""}
                  </span>
                  {item.assignedKsbCodes.length === 0 ? (
                    <p className={styles.hint}>No KSBs on this block yet.</p>
                  ) : (
                    <div className={styles.assignedPills}>
                      {item.assignedKsbCodes.map((code) => {
                        const ksb = ksbByCode(ksbs, code);
                        return (
                          <span key={code} className={styles.assignedPill}>
                            <strong title={ksb?.description}>{code}</strong>
                            <button
                              type="button"
                              aria-label={`Remove ${code}`}
                              onClick={() =>
                                commit(
                                  removeKsbFromBlock(sorted, item.id, code),
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
                <p className={styles.hint}>KSBs can only be assigned to blocks.</p>
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
        ))}
      </div>
    </div>
  );
}

function DropSlot({
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
      <span className={styles.dropZoneLabel}>
        {active ? "Drop here" : label}
      </span>
    </div>
  );
}
