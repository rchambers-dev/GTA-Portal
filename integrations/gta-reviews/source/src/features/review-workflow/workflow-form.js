import { reviewsList } from "../../app/dom.js";
import { cssEscape } from "../../lib/html.js";

export { cssEscape };

export function workflowForm(learnerId) {
  const id = cssEscape(learnerId);
  return (
    reviewsList?.querySelector(`[data-review-workflow="${id}"]`) ||
    reviewsList?.querySelector(`[data-completed-review="${id}"]`)
  );
}
