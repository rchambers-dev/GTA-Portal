"use client";

import { useRef } from "react";
import { sliderIndex, sliderLabel, sliderValueFromRatio, stepSlider, SLIDER_STOPS } from "../domain/slider";
import styles from "./website-form.module.css";

export function RatingSlider({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const index = sliderIndex(value);

  function chooseFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
    onChange(sliderValueFromRatio(ratio));
  }

  return (
    <div className={styles.sliderBlock}>
      <div className={styles.sliderEnds} aria-hidden="true">
        <span>Happy</span>
        <span>Sad</span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          chooseFromPointer(event.clientX);
        }}
      >
        <div className={styles.trackFill} />
        {SLIDER_STOPS.map((stop, stopIndex) => (
          <button
            key={stop.value}
            type="button"
            className={value === stop.value ? `${styles.stop} ${styles.stopOn}` : styles.stop}
            style={{ left: `${(stopIndex / (SLIDER_STOPS.length - 1)) * 100}%` }}
            aria-label={stop.label}
            onClick={() => onChange(stop.value)}
          />
        ))}
        {index != null ? (
          <span className={styles.thumb} style={{ left: `${(index / (SLIDER_STOPS.length - 1)) * 100}%` }} aria-hidden="true">
            <Face index={index} />
          </span>
        ) : null}
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={name}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={sliderLabel(value)}
        className={styles.sliderKeys}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") onChange(stepSlider(value, "left"));
          else if (event.key === "ArrowRight") onChange(stepSlider(value, "right"));
          else if (event.key === "Home") onChange(stepSlider(value, "home"));
          else if (event.key === "End") onChange(stepSlider(value, "end"));
          else return;
          event.preventDefault();
        }}
      />
      <div className={styles.stopLabels}>
        {SLIDER_STOPS.map((stop) => <span key={stop.value}>{stop.label}</span>)}
      </div>
      <p className={styles.selected}>
        Selected: {sliderLabel(value)}
        {value != null ? (
          <button type="button" className={styles.clear} onClick={() => onChange(null)}>Clear</button>
        ) : null}
      </p>
    </div>
  );
}

function Face({ index }: { index: number }) {
  const mouth = ["M6 14 Q12 20 18 14", "M6 14 Q12 18 18 14", "M6 15 H18", "M6 17 Q12 13 18 17", "M6 18 Q12 12 18 18"][index];
  const colour = ["#1f8a4c", "#7aa31a", "#e0b000", "#e06a2c", "#d7263d"][index];
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill={colour} />
      <circle cx="8" cy="10" r="1.3" fill="#fff" />
      <circle cx="16" cy="10" r="1.3" fill="#fff" />
      <path d={mouth} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
