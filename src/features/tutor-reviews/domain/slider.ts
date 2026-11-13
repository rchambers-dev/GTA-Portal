export const SLIDER_STOPS = [
  { value: 5, label: "Always" },
  { value: 4, label: "Often" },
  { value: 3, label: "Sometimes" },
  { value: 2, label: "Rarely" },
  { value: 1, label: "Never" },
] as const;

export function sliderLabel(value: number | null): string {
  return SLIDER_STOPS.find((stop) => stop.value === value)?.label ?? "Not selected";
}

/** Left of the track is Always (5). Right is Never (1). */
export function sliderValueFromRatio(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  const index = Math.round(clamped * (SLIDER_STOPS.length - 1));
  return SLIDER_STOPS[index].value;
}

export function sliderIndex(value: number | null): number | null {
  const index = SLIDER_STOPS.findIndex((stop) => stop.value === value);
  return index === -1 ? null : index;
}

export function stepSlider(value: number | null, direction: "left" | "right" | "home" | "end"): number {
  if (direction === "home") return 5;
  if (direction === "end") return 1;
  const index = sliderIndex(value);
  if (index == null) return direction === "left" ? 5 : 1;
  const next = direction === "left" ? Math.max(0, index - 1) : Math.min(SLIDER_STOPS.length - 1, index + 1);
  return SLIDER_STOPS[next].value;
}

export function canSubmitReview(page: number, explicitClick: boolean): boolean {
  return explicitClick && page === 3;
}
