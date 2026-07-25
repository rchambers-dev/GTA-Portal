import { NextResponse } from "next/server";
import { GiphyFetch } from "@giphy/js-fetch-api";
import type { IGif } from "@giphy/js-types";

/**
 * GIF / sticker search proxy for the chat composer, backed by the official
 * GIPHY SDK (`@giphy/js-fetch-api`).
 *
 * Query: `?q=&limit=&type=gifs|stickers`
 * The API key stays server-side. When unset, `configured: false` and the
 * client falls back to its curated offline catalog.
 */

const RATING = "g";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

type MediaKind = "gifs" | "stickers";

function pickUrls(gif: IGif): {
  url: string;
  previewUrl: string;
  stillUrl: string;
  mp4Url?: string;
  mp4PreviewUrl?: string;
} | null {
  const images = gif.images;
  // Grid / chat use a lighter downsampled WebP as image fallback.
  const preview =
    images?.fixed_width_downsampled?.webp ??
    images?.fixed_width?.webp ??
    images?.fixed_width_downsampled?.url ??
    images?.fixed_width?.url ??
    images?.downsized?.url ??
    images?.original?.webp ??
    images?.original?.url;
  // Slightly sharper asset for the attached / opened GIF.
  const full =
    images?.fixed_width?.webp ?? images?.fixed_width?.url ?? preview;
  const still =
    images?.fixed_width_still?.url ??
    images?.downsized_still?.url ??
    images?.original_still?.url ??
    preview;
  // Small MP4 for the picker grid; fuller MP4 for sent-message playback.
  const mp4PreviewUrl =
    images?.fixed_width_small?.mp4 ??
    images?.fixed_width?.mp4 ??
    images?.downsized_small?.mp4 ??
    images?.original?.mp4 ??
    undefined;
  const mp4Url =
    images?.fixed_width?.mp4 ??
    images?.original?.mp4 ??
    mp4PreviewUrl ??
    undefined;
  if (!preview || !full) return null;
  return {
    url: full,
    previewUrl: preview,
    stillUrl: still,
    ...(mp4Url ? { mp4Url } : {}),
    ...(mp4PreviewUrl ? { mp4PreviewUrl } : {}),
  };
}

export async function GET(request: Request) {
  const apiKey = process.env.GIPHY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ configured: false, items: [] });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const typeParam = (searchParams.get("type") ?? "gifs").toLowerCase();
  const mediaType: MediaKind =
    typeParam === "stickers" ? "stickers" : "gifs";
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const gf = new GiphyFetch(apiKey);

  try {
    const { data } = query
      ? await gf.search(query, { limit, rating: RATING, type: mediaType })
      : await gf.trending({ limit, rating: RATING, type: mediaType });

    const items = data
      .map((gif) => {
        const urls = pickUrls(gif);
        if (!urls) return null;
        return {
          id: String(gif.id),
          title:
            gif.title?.trim() ||
            (mediaType === "stickers" ? "Sticker" : "GIF"),
          ...urls,
        };
      })
      .filter((gif): gif is NonNullable<typeof gif> => gif !== null);

    return NextResponse.json({ configured: true, type: mediaType, items });
  } catch {
    return NextResponse.json(
      {
        configured: true,
        type: mediaType,
        items: [],
        error: "GIPHY search unavailable",
      },
      { status: 502 },
    );
  }
}
