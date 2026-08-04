"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Ae86BridgeLoader.module.css";

type Props = {
  /** When true, overlay is visible. */
  active: boolean;
  /** Optional label under the car. */
  label?: string;
  className?: string;
};

const SOURCE = { w: 1672, h: 941 };
/** Extra left/bottom room so exhaust isn’t clipped by canvas bounds. */
const VIEW = { w: 1500, h: 820 };
const EDGE_FADE = 120;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  born: number;
  life: number;
};

function edgeFade(x: number, y: number, r: number) {
  const left = Math.min(1, Math.max(0, (x - r) / EDGE_FADE));
  const right = Math.min(1, Math.max(0, (VIEW.w - x - r) / EDGE_FADE));
  const top = Math.min(1, Math.max(0, (y - r) / EDGE_FADE));
  const bottom = Math.min(1, Math.max(0, (VIEW.h - y - r) / EDGE_FADE));
  return Math.min(left, right, top, bottom);
}

/**
 * Scaled AE86 canvas loader for website ↔ portal handoff.
 * Renders into document.body so layout transforms cannot trap position:fixed.
 */
export function Ae86BridgeLoader({
  active,
  label = "Opening portal…",
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new Image();
    image.src = "/loaders/ae86.png";
    const particles: Particle[] = [];
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let start = performance.now();
    let alive = true;

    const fit = () => {
      const scale = Math.min(980 / SOURCE.w, 500 / SOURCE.h);
      const drawnW = SOURCE.w * scale;
      const drawnH = SOURCE.h * scale;
      return {
        scale,
        // Keep car optically centred with the label under it
        x: (VIEW.w - drawnW) / 2,
        y: (VIEW.h - drawnH) / 2,
      };
    };

    const smoke = (t: number, m: { scale: number; x: number; y: number }) => {
      if (!reduced && Math.random() < 0.42) {
        particles.push({
          x: m.x + 100 * m.scale,
          y: m.y + 690 * m.scale,
          vx: -1.1 - Math.random() * 1.35,
          vy: -0.12 - Math.random() * 0.45,
          r: 8 + Math.random() * 17,
          a: 0.28 + Math.random() * 0.16,
          born: t,
          life: 700 + Math.random() * 750,
        });
      }
      ctx.save();
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]!;
        const age = t - p.born;
        const k = age / p.life;
        if (k >= 1) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.16;

        const fade = edgeFade(p.x, p.y, p.r);
        if (fade <= 0.02) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = p.a * (1 - k) * fade;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(235,240,245,${alpha})`);
        g.addColorStop(1, "rgba(210,220,230,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const frame = (t: number) => {
      if (!alive) return;
      const m = fit();
      const elapsed = t - start;
      const bounce = reduced
        ? 0
        : Math.sin(elapsed * 0.012) * 6 + Math.sin(elapsed * 0.024) * 1.5;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      smoke(t, m);
      ctx.save();
      ctx.translate(0, bounce);
      ctx.drawImage(
        image,
        m.x,
        m.y,
        SOURCE.w * m.scale,
        SOURCE.h * m.scale,
      );
      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    };

    image.onload = () => {
      start = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    };

    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  if (!active || !mounted) return null;

  return createPortal(
    <div
      className={`${styles.overlay}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={styles.panel}>
        <div className={styles.stage}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            width={VIEW.w}
            height={VIEW.h}
          />
        </div>
        <p className={styles.label}>{label}</p>
      </div>
    </div>,
    document.body,
  );
}
