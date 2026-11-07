import {
  authConfigured,
  currentSession,
  onAuthChange,
} from "../auth.js";
import { claimAccountSession } from "../session-lock.js";
import {
  abandonSession,
  accountIsClosed,
  closeAccount,
  setSessionHoldsSaves,
} from "./persist.js";
import { replaceAccountState } from "./account-state.js";
import { clearConflictPrompt, syncConflictSession } from "../storage.js";
import {
  applySignedInSession,
  bindAuthUi,
  showLoginError,
} from "./auth-ui.js";
import { bindFeedback } from "./feedback.js";

const REQUIRED_HOOKS = [
  "prepareLoadedWorkspace",
  "setStatus",
  "cancelMapDraw",
  "resetUiState",
  "getState",
];

let hooks = null;
let appStarted = false;
let openingApp = null;

export function bootstrap(next) {
  const missing = REQUIRED_HOOKS.filter((key) => typeof next?.[key] !== "function");
  if (missing.length) {
    throw new Error(`App modules are not bound: ${missing.join(", ")}`);
  }
  hooks = next;
  bindFeedback({ getState: next.getState });
  bindAuthUi({ setStatus: next.setStatus });
}

function sessionHooks() {
  return {
    onConflictStart() {
      setSessionHoldsSaves(true);
    },
    onConflictClear() {
      setSessionHoldsSaves(false);
    },
    onClosed(message) {
      closeAccount();
      showLoginError(
        message || "You were signed out because this account was opened in another browser.",
      );
    },
  };
}

function clearSignedOutState() {
  abandonSession();
  hooks.cancelMapDraw();
  hooks.resetUiState();
  replaceAccountState(hooks.getState());
  appStarted = false;
  openingApp = null;
}

// openSignedInApp is the old openApp.
export function openSignedInApp(session) {
  if (openingApp) return openingApp;
  openingApp = (async () => {
    document.body.classList.remove("session-closed");
    const allowed = await claimAccountSession(session, sessionHooks());
    if (!allowed) {
      appStarted = false;
      openingApp = null;
      return;
    }
    await hooks.prepareLoadedWorkspace();
  })();
  return openingApp;
}

export const openApp = openSignedInApp;

// startAuthBoot is the old boot.
export async function startAuthBoot() {
  if (!hooks) {
    throw new Error("App modules are not bound: bootstrap");
  }
  if (!authConfigured()) {
    applySignedInSession(null);
    showLoginError(
      "Add your Supabase URL and anon key to a .env file, then restart the app.",
    );
    return;
  }
  let session = null;
  try {
    session = await currentSession();
  } catch (error) {
    showLoginError(error.message || "Could not check if you are signed in.");
  }
  applySignedInSession(session);
  onAuthChange((next) => {
    applySignedInSession(next);
    // Sign-out does not reload the page. Drop the previous account's state
    // before the next sign-in loads a new copy.
    if (!next) {
      clearConflictPrompt();
      clearSignedOutState();
      return;
    }
    syncConflictSession(next);
    if (accountIsClosed()) return;
    if (!appStarted) {
      appStarted = true;
      openSignedInApp(next);
    }
  });
  if (!session) return;
  appStarted = true;
  await openSignedInApp(session);
}

export const boot = startAuthBoot;
