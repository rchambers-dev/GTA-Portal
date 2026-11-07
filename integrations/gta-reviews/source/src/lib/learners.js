export const TEST_LEARNER_ID = "00000000-0000-4000-a000-000000000001";

// Roster check. Exact name "Test Learner", no company match.
export function isTestLearner(learner, learnerId = "") {
  const id = learner?.id || learnerId;
  return Boolean(learner?.isTest) || id === TEST_LEARNER_ID || learner?.name === "Test Learner";
}

// Report check. Also matches a trimmed case-insensitive name and the test company.
export function isReportTestLearner(learner, learnerId = "") {
  const id = String(learner?.id || learnerId || "").trim();
  const name = String(learner?.name || "").trim().toLowerCase();
  const company = String(learner?.company || "").trim().toLowerCase();
  return (
    Boolean(learner?.isTest) ||
    id === TEST_LEARNER_ID ||
    name === "test learner" ||
    company === "test company ltd"
  );
}

// exclude(item) skips a row without recording its id, which is how reports drop test learners.
export function allLearners(state, exclude) {
  const seen = new Set();
  const rows = [];
  for (const list of [state.learners, state.followUps, state.archive]) {
    for (const item of list || []) {
      if (!item?.id || seen.has(item.id)) continue;
      if (exclude?.(item)) continue;
      seen.add(item.id);
      rows.push(item);
    }
  }
  return rows;
}
