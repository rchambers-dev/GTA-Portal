import { describe, expect, it } from "vitest";
import { canSubmitReview, sliderLabel, sliderValueFromRatio, stepSlider } from "./slider";

describe("tutor review slider", () => {
  it("maps the left of the track to Always and the right to Never", () => {
    expect(sliderValueFromRatio(0)).toBe(5);
    expect(sliderValueFromRatio(0.25)).toBe(4);
    expect(sliderValueFromRatio(0.5)).toBe(3);
    expect(sliderValueFromRatio(0.75)).toBe(2);
    expect(sliderValueFromRatio(1)).toBe(1);
    expect(sliderLabel(5)).toBe("Always");
    expect(sliderLabel(1)).toBe("Never");
    expect(sliderLabel(null)).toBe("Not selected");
  });

  it("moves between the five stops and can start from a blank answer", () => {
    expect(stepSlider(null, "left")).toBe(5);
    expect(stepSlider(null, "right")).toBe(1);
    expect(stepSlider(5, "right")).toBe(4);
    expect(stepSlider(1, "left")).toBe(2);
    expect(stepSlider(3, "home")).toBe(5);
    expect(stepSlider(3, "end")).toBe(1);
  });

  it("submits only from an explicit click on page 3", () => {
    expect(canSubmitReview(1, true)).toBe(false);
    expect(canSubmitReview(2, true)).toBe(false);
    expect(canSubmitReview(3, false)).toBe(false);
    expect(canSubmitReview(3, true)).toBe(true);
  });
});
