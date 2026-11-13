import { describe, expect, it } from "vitest";
import { canSubmitReview, DEFAULT_RATING, ratingAnswers, sliderLabel, sliderRatioFromClient, sliderValueFromRatio, stepSlider } from "./slider";

describe("tutor review slider", () => {
  it("maps the left of the track to Always and the right to Never", () => {
    expect(sliderValueFromRatio(0)).toBe(5);
    expect(sliderValueFromRatio(0.25)).toBe(4);
    expect(sliderValueFromRatio(0.5)).toBe(3);
    expect(sliderValueFromRatio(0.75)).toBe(2);
    expect(sliderValueFromRatio(1)).toBe(1);
    expect(sliderLabel(5)).toBe("Always");
    expect(sliderLabel(4)).toBe("Usually");
    expect(sliderLabel(1)).toBe("Never");
  });

  it("maps a click on the inset track to the same stop as the face", () => {
    const width = 360;
    const inset = 22;
    expect(sliderRatioFromClient(inset, 0, width, inset)).toBe(0);
    expect(sliderRatioFromClient(width / 2, 0, width, inset)).toBe(0.5);
    expect(sliderRatioFromClient(width - inset, 0, width, inset)).toBe(1);
    expect(sliderRatioFromClient(inset + (width - inset * 2) * 0.25, 0, width, inset)).toBeCloseTo(0.25);
  });

  it("starts on Sometimes and snaps with the arrow keys", () => {
    expect(DEFAULT_RATING).toBe(3);
    expect(sliderLabel(DEFAULT_RATING)).toBe("Sometimes");
    expect(stepSlider(3, "left")).toBe(4);
    expect(stepSlider(3, "right")).toBe(2);
    expect(stepSlider(5, "left")).toBe(5);
    expect(stepSlider(1, "right")).toBe(1);
  });

  it("submits Sometimes when a rating was not moved", () => {
    expect(ratingAnswers(
      [{ code: "01", kind: "rating_1_5" }, { code: "06", kind: "yes_no" }],
      {},
    )).toEqual([{ code: "01", rating: 3 }]);
  });

  it("submits only from an explicit click on page 3", () => {
    expect(canSubmitReview(1, true)).toBe(false);
    expect(canSubmitReview(2, true)).toBe(false);
    expect(canSubmitReview(3, false)).toBe(false);
    expect(canSubmitReview(3, true)).toBe(true);
  });
});
