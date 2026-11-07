let hooks = null;

function reportUnbound() {
  console.error("Failed to run the review workflow:", "review workflow callbacks are not bound.");
}

function callHook(name, args, fallback) {
  const fn = hooks?.[name];
  if (typeof fn !== "function") {
    reportUnbound();
    return fallback;
  }
  return fn(...args);
}

// Live view of the bound app state. Read and write properties only.
// This proxy must not be spread or serialised: object spread, Object.keys,
// and JSON.stringify see the empty target, not the real state.
export const state = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!hooks?.state) {
        reportUnbound();
        return undefined;
      }
      const value = hooks.state[prop];
      return typeof value === "function" ? value.bind(hooks.state) : value;
    },
    set(_target, prop, value) {
      if (!hooks?.state) {
        reportUnbound();
        return true;
      }
      hooks.state[prop] = value;
      return true;
    },
  },
);

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function renderReviews(...args) {
  return callHook("renderReviews", args, undefined);
}

export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}

export function saveReviewTargets(...args) {
  return callHook("saveReviewTargets", args, undefined);
}

export function previewReviewForm(...args) {
  return callHook("previewReviewForm", args, undefined);
}

export function holdReview(...args) {
  return callHook("holdReview", args, undefined);
}

export function readSettingsIntoState(...args) {
  return callHook("readSettingsIntoState", args, undefined);
}

export function reviewFormEmailBody(...args) {
  return callHook("reviewFormEmailBody", args, "");
}

export function loadReviewFormPdf(...args) {
  return callHook("loadReviewFormPdf", args, null);
}

export function reviewDateLabel(...args) {
  return callHook("reviewDateLabel", args, "");
}

export function reviewsTodayKey(...args) {
  return callHook("reviewsTodayKey", args, "");
}

export function findEditableLearner(...args) {
  return callHook("findEditableLearner", args, null);
}

export function saveManagedDetails(...args) {
  return callHook("saveManagedDetails", args, false);
}

export function stampOutPdfOpened(...args) {
  return callHook("stampOutPdfOpened", args, undefined);
}

export function logAction(...args) {
  return callHook("logAction", args, undefined);
}

export function bindReviewWorkflow(next) {
  hooks = next;
}
