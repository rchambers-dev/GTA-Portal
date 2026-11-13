"use client";

import { useRef, useState, type CSSProperties } from "react";
import { DEFAULT_RATING, faceColour, sliderLabel, sliderRatioFromClient, sliderRatioFromValue, sliderValueFromRatio, stepSlider, SLIDER_STOPS, SLIDER_THUMB_PX } from "../domain/slider";
import styles from "./website-form.module.css";

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
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const committed = value ?? DEFAULT_RATING;
  const ratio = dragRatio ?? sliderRatioFromValue(committed);
  const shown = dragRatio == null ? committed : sliderValueFromRatio(dragRatio);

  function ratioFrom(clientX: number) {
    const track = trackRef.current;
    if (!track) return sliderRatioFromValue(committed);
    const rect = track.getBoundingClientRect();
    const inset = Number.parseFloat(getComputedStyle(track).getPropertyValue("--inset")) || SLIDER_THUMB_PX / 2;
    return sliderRatioFromClient(clientX, rect.left, rect.width, inset);
  }

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
          event.currentTarget.dataset.pointing = "true";
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          setDragRatio(ratioFrom(event.clientX));
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          setDragRatio(ratioFrom(event.clientX));
        }}
        onPointerUp={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          onChange(sliderValueFromRatio(ratioFrom(event.clientX)));
          setDragRatio(null);
        }}
        onPointerCancel={() => setDragRatio(null)}
        onBlur={(event) => {
          delete event.currentTarget.dataset.pointing;
        }}
        onKeyDown={(event) => {
          delete event.currentTarget.dataset.pointing;
          if (event.key === "ArrowLeft") onChange(stepSlider(committed, "left"));
          else if (event.key === "ArrowRight") onChange(stepSlider(committed, "right"));
          else if (event.key === "Home") onChange(stepSlider(committed, "home"));
          else if (event.key === "End") onChange(stepSlider(committed, "end"));
          else return;
          event.preventDefault();
        }}
      >
        <div className={styles.trackFill} />
        <span className={styles.thumb} style={{ "--ratio": ratio } as CSSProperties} aria-hidden="true">
          <Face ratio={ratio} />
        </span>
      </div>
      <div className={styles.stopLabels}>
        {SLIDER_STOPS.map((stop, index) => (
          <span
            key={stop.value}
            className={`${styles.stop} ${index === 0 ? styles.stopFirst : ""} ${index === SLIDER_STOPS.length - 1 ? styles.stopLast : ""} ${stop.value === shown ? styles.stopOn : ""}`}
            style={{ "--stop": index / (SLIDER_STOPS.length - 1) } as CSSProperties}
          >
            {stop.label}
          </span>
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
