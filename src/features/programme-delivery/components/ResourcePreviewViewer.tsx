"use client";

import { useEffect, useState } from "react";
import styles from "./resource-preview-viewer.module.css";

type SlideInfo = {
  index: number;
  hasImage: boolean;
  text: string[];
};

export function ResourcePreviewViewer(input: {
  title: string;
  slideApiBase: string;
  previewApi: string;
  slideQuery?: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<SlideInfo[]>([]);
  const [index, setIndex] = useState(1);

  useEffect(() => {
    let cancelled = false;
    void fetch(input.previewApi)
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          preview?: { slides?: SlideInfo[]; slideCount?: number };
        };
        if (cancelled) return;
        if (!json.ok || !json.preview?.slides?.length) {
          setError(json.error || "Preview unavailable");
          setLoading(false);
          return;
        }
        setSlides(json.preview.slides);
        setIndex(json.preview.slides[0]?.index || 1);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not open preview.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [input.previewApi]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") input.onClose();
      if (event.key === "ArrowLeft") {
        setIndex((n) => Math.max(1, n - 1));
      }
      if (event.key === "ArrowRight") {
        setIndex((n) => Math.min(slides.length || 1, n + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input.onClose, slides.length]);

  const current = slides.find((s) => s.index === index) ?? slides[0] ?? null;
  const count = slides.length;
  const query = input.slideQuery ? `?${input.slideQuery}` : "";
  const imageSrc = current?.hasImage
    ? `${input.slideApiBase}/${current.index}${query}`
    : null;

  return (
    <div className={styles.shell} role="dialog" aria-label={input.title}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Presentation</p>
          <h3 className={styles.title}>{input.title}</h3>
        </div>
        <button type="button" className={styles.close} onClick={input.onClose}>
          Close
        </button>
      </div>
      {loading ? (
        <p className={styles.note}>Opening presentation…</p>
      ) : error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : current ? (
        <>
          <p className={styles.meta}>
            Slide {index} of {count}
          </p>
          <div className={styles.stage}>
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt={
                  current.text[0]
                    ? `Slide ${index}: ${current.text[0]}`
                    : `Slide ${index} of ${input.title}`
                }
                className={styles.slideImage}
              />
            ) : (
              <div className={styles.textSlide}>
                {(current.text.length ? current.text : ["No slide text was stored for this preview."]).map(
                  (line, i) => (
                    <p key={i}>{line}</p>
                  ),
                )}
              </div>
            )}
          </div>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navBtn}
              disabled={index <= 1}
              onClick={() => setIndex((n) => Math.max(1, n - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className={styles.navBtn}
              disabled={index >= count}
              onClick={() => setIndex((n) => Math.min(count, n + 1))}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
