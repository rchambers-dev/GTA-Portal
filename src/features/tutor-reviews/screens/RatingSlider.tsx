"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_RATING, faceColour, faceTint, sliderLabel, sliderRatioFromClient, sliderRatioFromValue, sliderValueFromRatio, stepSlider, SLIDER_STOPS, SLIDER_THUMB_PX } from "../domain/slider";
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
  const trackRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const initialRatio = sliderRatioFromValue(value ?? DEFAULT_RATING);
  const shownRatio = useRef(initialRatio);
  const frame = useRef(0);
  const [ratio, setRatio] = useState(initialRatio);
  const [pillWidth, setPillWidth] = useState(64);
  const committed = value ?? DEFAULT_RATING;
  const shown = sliderValueFromRatio(ratio);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function paint(next: number) {
    shownRatio.current = next;
    setRatio(next);
  }

  function animateTo(target: number) {
    cancelAnimationFrame(frame.current);
    const from = shownRatio.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / MOVE_MS);
      const eased = 1 - (1 - t) ** 3;
      paint(t === 1 ? target : from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  function choose(next: number) {
    onChange(next);
    animateTo(sliderRatioFromValue(next));
  }

  function ratioFrom(clientX: number) {
    const track = trackRef.current;
    if (!track) return sliderRatioFromValue(committed);
    const rect = track.getBoundingClientRect();
    const inset = Number.parseFloat(getComputedStyle(track).getPropertyValue("--inset")) || SLIDER_THUMB_PX / 2;
    return sliderRatioFromClient(clientX, rect.left, rect.width, inset);
  }

  function pointerRatio(event: ReactPointerEvent<HTMLDivElement>) {
    return ratioFrom(event.clientX);
  }

  useLayoutEffect(() => {
    const index = SLIDER_STOPS.findIndex((stop) => stop.value === shown);
    const label = labelRefs.current[index];
    if (!label) return;
    const width = label.offsetWidth;
    setPillWidth((current) => (current === width ? current : width));
  }, [shown]);

  return (
    <div className={styles.sliderBlock}>
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
          event.currentTarget.dataset.pointing = "true";
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          paint(pointerRatio(event));
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          paint(pointerRatio(event));
        }}
        onPointerUp={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const next = sliderValueFromRatio(pointerRatio(event));
          onChange(next);
          animateTo(sliderRatioFromValue(next));
        }}
        onPointerCancel={() => {
          animateTo(sliderRatioFromValue(committed));
        }}
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
      <div ref={labelsRef} className={styles.stopLabels} aria-hidden="true">
        <span
          className={styles.pill}
          style={{ "--ratio": ratio, width: pillWidth, background: faceTint(ratio) } as CSSProperties}
        />
        {SLIDER_STOPS.map((stop, index) => (
          <button
            key={stop.value}
            ref={(node) => { labelRefs.current[index] = node; }}
            type="button"
            tabIndex={-1}
            className={`${styles.stop} ${index === 0 ? styles.stopFirst : ""} ${index === SLIDER_STOPS.length - 1 ? styles.stopLast : ""} ${stop.value === shown ? styles.stopOn : ""}`}
            style={{ "--stop": index / (SLIDER_STOPS.length - 1) } as CSSProperties}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              choose(stop.value);
            }}
          >
            {stop.label}
          </button>
        ))}
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
