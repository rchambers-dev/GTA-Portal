export const SLIDER_STOPS = [
  { value: 5, label: "Always" },
  { value: 4, label: "Usually" },
  { value: 3, label: "Sometimes" },
  { value: 2, label: "Rarely" },
  { value: 1, label: "Never" },
] as const;

/** An untouched rating is Sometimes. */
export const DEFAULT_RATING = 3;

export function sliderLabel(value: number): string {
  return SLIDER_STOPS.find((stop) => stop.value === value)?.label ?? "Sometimes";
}

/** Thumb diameter. The face and the labels share an inset of half this width. */
export const SLIDER_THUMB_PX = 44;

/** Left of the track is Always (5). Right is Never (1). */
export function sliderValueFromRatio(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  const index = Math.round(clamped * (SLIDER_STOPS.length - 1));
  return SLIDER_STOPS[index].value;
}

/** Padding inside the segmented label pill. The face and the raised segment share this inset. */
export const SEGMENT_PAD_PX = 4;

/**
 * Pointer position mapped onto the five equal segments.
 * Ratio 0 is the centre of Always, 1 is the centre of Never.
 */
export function sliderRatioFromSegment(clientX: number, left: number, width: number, pad = SEGMENT_PAD_PX): number {
  const inner = width - pad * 2;
  const segment = inner / SLIDER_STOPS.length;
  const start = left + pad + segment / 2;
  const usable = inner - segment;
  if (usable <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - start) / usable));
}

/** Pointer position mapped onto the usable track, inset by half the thumb on each side. */
export function sliderRatioFromClient(clientX: number, left: number, width: number, inset = SLIDER_THUMB_PX / 2): number {
  const usable = width - inset * 2;
  if (usable <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - left - inset) / usable));
}

export function sliderRatioFromValue(value: number): number {
  const index = SLIDER_STOPS.findIndex((stop) => stop.value === value);
  const safe = index === -1 ? 2 : index;
  return safe / (SLIDER_STOPS.length - 1);
}

export function stepSlider(value: number, direction: "left" | "right" | "home" | "end"): number {
  if (direction === "home") return 5;
  if (direction === "end") return 1;
  const index = SLIDER_STOPS.findIndex((stop) => stop.value === value);
  const current = index === -1 ? 2 : index;
  const next = direction === "left" ? Math.max(0, current - 1) : Math.min(SLIDER_STOPS.length - 1, current + 1);
  return SLIDER_STOPS[next].value;
}

export function faceColour(ratio: number): string {
  const stops = [
    [31, 138, 76],
    [122, 163, 26],
    [224, 176, 0],
    [224, 106, 44],
    [215, 38, 61],
  ];
  const clamped = Math.min(1, Math.max(0, ratio));
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const colour = stops[index].map((channel, offset) => Math.round(channel + (stops[index + 1][offset] - channel) * mix));
  return `rgb(${colour.join(", ")})`;
}

/** A light tint of the face colour, for the label highlight. */
export function faceTint(ratio: number): string {
  const channels = faceColour(ratio).match(/\d+/g)?.map(Number) ?? [170, 194, 234];
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * 0.78));
  return `rgb(${mixed.join(", ")})`;
}

export function canSubmitReview(page: number, explicitClick: boolean): boolean {
  return explicitClick && page === 3;
}

export function ratingAnswers(
  questions: { code: string; kind: string }[],
  ratings: Record<string, number>,
): { code: string; rating: number }[] {
  return questions
    .filter((question) => question.kind === "rating_1_5")
    .map((question) => ({ code: question.code, rating: ratings[question.code] ?? DEFAULT_RATING }));
}
