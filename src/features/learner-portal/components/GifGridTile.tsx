"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatGifOption } from "../domain/chat/composer-assets";
import styles from "./ChatComposer.module.css";

/**
 * Discord-style GIF tile: prefer muted looping MP4 (GPU decode), and only
 * play while the tile is visible in the scrollable grid.
 */
export function GifGridTile({
  gif,
  onSelect,
  onBroken,
}: {
  gif: ChatGifOption;
  onSelect: () => void;
  onBroken: () => void;
}) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const useVideo =
    Boolean(gif.mp4PreviewUrl ?? gif.mp4Url) && !videoFailed;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const root = el.closest(`.${styles.gifGrid}`);
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      {
        root: root instanceof Element ? root : null,
        rootMargin: "40px 0px",
        threshold: 0.2,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !useVideo) return;
    if (inView) {
      void video.play().catch(() => {
        // Autoplay can fail before src is ready; ignore — poster still shows.
      });
    } else {
      video.pause();
    }
  }, [inView, useVideo, gif.mp4PreviewUrl, gif.mp4Url]);

  return (
    <button
      ref={rootRef}
      type="button"
      className={styles.gifTile}
      onClick={onSelect}
      aria-label={`Attach GIF: ${gif.title}`}
    >
      {useVideo ? (
        <video
          ref={videoRef}
          className={styles.gifTileMedia}
          src={gif.mp4PreviewUrl ?? gif.mp4Url}
          poster={gif.stillUrl ?? gif.previewUrl}
          muted
          loop
          playsInline
          preload={inView ? "auto" : "metadata"}
          onError={() => setVideoFailed(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.gifTileMedia}
          src={inView ? gif.previewUrl : (gif.stillUrl ?? gif.previewUrl)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={onBroken}
        />
      )}
    </button>
  );
}
