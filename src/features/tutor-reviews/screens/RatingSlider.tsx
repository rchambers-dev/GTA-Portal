"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_RATING, faceColour, faceTint, SEGMENT_PAD_PX, sliderLabel, sliderRatioFromSegment, sliderRatioFromValue, sliderValueFromRatio, stepSlider, SLIDER_STOPS } from "../domain/slider";
import styles from "./website-form.module.css";

const MOVE_MS = 200;

export function RatingSlider({
  name,
  value,
  onChange,
}: {
  name: string;
  value?: number;
  onChange: (value: number) => void;
}) {
  const blockRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const initialRatio = sliderRatioFromValue(value ?? DEFAULT_RATING);
  const shownRatio = useRef(initialRatio);
  const dragging = useRef(false);
  const frame = useRef(0);
  const settle = useRef(0);
  const [ratio, setRatio] = useState(initialRatio);
  const [segmentWidth, setSegmentWidth] = useState<number | null>(null);
  const committed = value ?? DEFAULT_RATING;
  const shown = sliderValueFromRatio(ratio);
  const onChangeRef = useRef(onChange);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(settle.current);
  }, []);

  function paint(next: number) {
    shownRatio.current = next;
    setRatio(next);
  }

  function animateTo(target: number) {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(settle.current);
    const block = blockRef.current;
    if (block) delete block.dataset.dragging;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(target);
      return;
    }
    const from = shownRatio.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / MOVE_MS);
      const eased = 1 - (1 - t) ** 3;
      paint(t === 1 ? target : from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    settle.current = window.setTimeout(() => paint(target), MOVE_MS + 40);
  }

  function choose(next: number) {
    onChangeRef.current(next);
    animateTo(sliderRatioFromValue(next));
  }

  function ratioFrom(clientX: number) {
    const block = blockRef.current;
    if (!block) return shownRatio.current;
    const rect = block.getBoundingClientRect();
    const pad = Number.parseFloat(getComputedStyle(block).getPropertyValue("--pad")) || SEGMENT_PAD_PX;
    return sliderRatioFromSegment(clientX, rect.left, rect.width, pad);
  }

  function finishDrag(clientX?: number) {
    if (!dragging.current) return;
    dragging.current = false;
    const raw = clientX == null ? shownRatio.current : ratioFrom(clientX);
    const next = sliderValueFromRatio(raw);
    onChangeRef.current(next);
    animateTo(sliderRatioFromValue(next));
  }

  const finishDragRef = useRef<(clientX?: number) => void>(() => {});

  useEffect(() => {
    onChangeRef.current = onChange;
    finishDragRef.current = finishDrag;
  });

  useLayoutEffect(() => {
    const measure = () => {
      const tray = trayRef.current;
      const index = SLIDER_STOPS.findIndex((stop) => stop.value === shown);
      const word = textRefs.current[index];
      if (!tray || !word) return;
      const trayBox = tray.getBoundingClientRect();
      const pad = Number.parseFloat(getComputedStyle(tray).getPropertyValue("--pad")) || 4;
      const fifth = (trayBox.width - pad * 2) / SLIDER_STOPS.length;
      const textWidth = word.getBoundingClientRect().width;
      const narrow = trayBox.width < 560;
      const trayLeft = trayBox.left;
      const previous = textRefs.current[index - 1]?.getBoundingClientRect();
      const next = textRefs.current[index + 1]?.getBoundingClientRect();
        const minLeft = previous ? previous.right - trayLeft + 4 : pad;
        const maxRight = next ? next.left - trayLeft - 4 : trayBox.width - pad;
      const center = pad + fifth * (index + 0.5);
      const maxHalf = Math.max(0, Math.min(center - minLeft, maxRight - center));
      const padded = textWidth + (narrow ? 12 : 0);
      let desired = narrow ? Math.min(Math.max(padded, fifth - 8), maxHalf * 2) : fifth;
      if (narrow) desired = Math.max(desired, Math.min(padded, maxHalf * 2));
      const nextWidth = Math.ceil(desired);
      setSegmentWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shown]);

  useEffect(() => {
    const end = (event: PointerEvent) => finishDragRef.current(event.clientX);
    const cancel = () => finishDragRef.current();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  return (
    <div ref={blockRef} className={styles.sliderBlock}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={name}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={shown}
        aria-valuetext={sliderLabel(shown)}
        className={styles.track}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          cancelAnimationFrame(frame.current);
          window.clearTimeout(settle.current);
          dragging.current = true;
          if (blockRef.current) blockRef.current.dataset.dragging = "true";
          event.currentTarget.dataset.pointing = "true";
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          paint(ratioFrom(event.clientX));
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          paint(ratioFrom(event.clientX));
        }}
        onPointerUp={(event) => finishDrag(event.clientX)}
        onPointerCancel={() => finishDrag()}
        onLostPointerCapture={() => finishDrag()}
        onBlur={(event) => {
          delete event.currentTarget.dataset.pointing;
        }}
        onKeyDown={(event) => {
          delete event.currentTarget.dataset.pointing;
          const next = event.key === "ArrowLeft" ? stepSlider(committed, "left")
            : event.key === "ArrowRight" ? stepSlider(committed, "right")
            : event.key === "Home" ? stepSlider(committed, "home")
            : event.key === "End" ? stepSlider(committed, "end")
            : null;
          if (next == null) return;
          event.preventDefault();
          choose(next);
        }}
      >
        <div className={styles.trackFill} />
        <span className={styles.thumb} style={{ "--ratio": ratio } as CSSProperties} aria-hidden="true">
          <Face ratio={ratio} />
        </span>
      </div>
      <div ref={trayRef} className={styles.segmentTray} aria-hidden="true">
        <span
          className={styles.segment}
          style={{
            "--ratio": ratio,
            "--segment-width": segmentWidth == null ? undefined : `${segmentWidth}px`,
            background: faceTint(ratio),
          } as CSSProperties}
        />
        <div className={styles.segmentLabels}>
          {SLIDER_STOPS.map((stop, index) => (
            <button
              key={stop.value}
              type="button"
              tabIndex={-1}
              className={stop.value === shown ? `${styles.stop} ${styles.stopOn}` : styles.stop}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                choose(stop.value);
              }}
            >
              <span ref={(node) => { textRefs.current[index] = node; }} className={styles.word}>{stop.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Face({ ratio }: { ratio: number }) {
  const start = 14 + ratio * 4;
  const curve = 20 - ratio * 8;
  return (
    <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill={faceColour(ratio)} />
      <circle cx="8" cy="10" r="1.3" fill="#fff" />
      <circle cx="16" cy="10" r="1.3" fill="#fff" />
      <path d={`M6 ${start} Q12 ${curve} 18 ${start}`} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
