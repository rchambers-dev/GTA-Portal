import { isLikelyUkPostcode } from "../../geo.js";
import { WEEKDAYS } from "../../planner.js";

export function validateLearner({ name, postcode, collegeDay }) {
  if (!name) return "Enter the learner’s name.";
  if (String(postcode || "").trim() && !isLikelyUkPostcode(postcode)) {
    return "Enter a valid UK postcode.";
  }
  if (collegeDay && !WEEKDAYS.includes(collegeDay)) return "Choose a college day.";
  return "";
}
