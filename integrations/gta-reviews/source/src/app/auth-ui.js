import {
  changePassword,
  isAdminSession,
  isOfficeSession,
  isTutorSession,
  needsPasswordChange,
  rememberedEmail,
  rememberLoginEnabled,
  signIn,
  signOut,
} from "../auth.js";
import { ledeReviews, reviewsSearch } from "./dom.js";
import {
  applyPhoneOutMode,
  isPhoneHandset,
  phoneOutMode,
  phonePreviewForced,
} from "../features/out-round.js";
import { renderTutorFeedbackInbox, handleFeedbackSend } from "./feedback.js";

export let signedInSession = null;
export let tutorMode = false;
export let officeMode = false;
export let adminMode = false;

let hooks = null;

export function bindAuthUi(next) {
  hooks = next;
  const emailInput = document.querySelector("#login-email");
  const rememberInput = document.querySelector("#login-remember");
  if (rememberInput) rememberInput.checked = rememberLoginEnabled();
  if (emailInput && !emailInput.value) emailInput.value = rememberedEmail();
  document.querySelector("#login-form")?.addEventListener("submit", handleSignIn);
  document.querySelector("#settings-password-form")?.addEventListener("submit", handlePasswordChange);
  document.querySelector("#settings-password-form")?.addEventListener("input", syncPasswordMatch);
  document.addEventListener("mousedown", (event) => {
    if (passwordChangeNeeded()) return;
    const form = document.querySelector("#settings-password-form");
    if (!form || form.contains(event.target)) return;
    resetPasswordForm();
  });
  document.querySelector("#settings-feedback-form")?.addEventListener("submit", handleFeedbackSend);
  ["click", "pointerdown", "keydown"].forEach((type) => {
    document.addEventListener(type, guardPasswordLock, true);
  });
  document.querySelector("#account-settings")?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (forcePasswordChange()) return;
    const modal = document.querySelector("[data-settings-modal]");
    if (modal?.classList.contains("open")) closeAccountSettings();
    else openAccountSettings();
  });
  document.querySelector("[data-settings-modal]")?.addEventListener("click", (event) => {
    if (passwordChangeNeeded()) {
      if (!isPasswordLockAllowed(event.target)) {
        forcePasswordChange();
        return;
      }
    } else if (!event.target.closest("[data-settings-card]") || event.target.closest("[data-settings-close]")) {
      closeAccountSettings();
      return;
    }
    if (event.target.closest("[data-settings-back]")) {
      showSettingsHome();
      return;
    }
    const openRow = event.target.closest("[data-settings-open]");
    if (openRow) {
      showSettingsTab(openRow.dataset.settingsOpen || "account");
      return;
    }
    const tab = event.target.closest("[data-settings-tab]");
    if (tab) {
      showSettingsTab(tab.dataset.settingsTab || "account");
      return;
    }
    const text = event.target.closest("[data-appearance-text]");
    if (text) {
      applyAppearance({ ...loadAppearance(), text: text.dataset.appearanceText });
      return;
    }
    const font = event.target.closest("[data-appearance-font]");
    if (font) {
      applyAppearance({ ...loadAppearance(), font: font.dataset.appearanceFont });
      return;
    }
    const theme = event.target.closest("[data-appearance-theme]");
    if (theme) {
      applyAppearance({ ...loadAppearance(), theme: theme.dataset.appearanceTheme });
    }
  });
  document.querySelectorAll("#sign-out, [data-settings-sign-out]").forEach((button) => {
    button.addEventListener("click", () => {
      closeAccountSettings({ force: true });
      signOut().catch((error) => hooks?.setStatus?.(error.message || "Could not sign out."));
    });
  });
}

function loginErrorEl() {
  return document.querySelector("#login-error");
}

export function showLoginError(message) {
  const box = loginErrorEl();
  if (!box) return;
  box.hidden = !message;
  box.textContent = message || "";
}

const APPEARANCE_KEY = "review-assistant-appearance";
const defaultAppearance = { text: "default", font: "outfit", theme: "default" };

function loadAppearance() {
  try {
    return { ...defaultAppearance, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}") };
  } catch {
    return { ...defaultAppearance };
  }
}

export function applyAppearance(next = loadAppearance()) {
  const appearance = { ...defaultAppearance, ...next };
  const root = document.documentElement;
  root.dataset.text = appearance.text;
  root.dataset.font = appearance.font;
  root.dataset.theme = appearance.theme;
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  document.querySelectorAll("[data-appearance-text]").forEach((button) => {
    button.classList.toggle("on", button.dataset.appearanceText === appearance.text);
    button.classList.toggle("ghost", button.dataset.appearanceText !== appearance.text);
  });
  document.querySelectorAll("[data-appearance-font]").forEach((button) => {
    button.classList.toggle("on", button.dataset.appearanceFont === appearance.font);
    button.classList.toggle("ghost", button.dataset.appearanceFont !== appearance.font);
  });
  document.querySelectorAll("[data-appearance-theme]").forEach((button) => {
    button.classList.toggle("on", button.dataset.appearanceTheme === appearance.theme);
    button.classList.toggle("ghost", button.dataset.appearanceTheme !== appearance.theme);
  });
}

function allowedSettingsTab(id) {
  if ((tutorMode || officeMode) && (id === "plan" || id === "out")) return "account";
  return id || "account";
}

function phoneSettingsLayout() {
  return (
    phoneOutMode() ||
    isPhoneHandset() ||
    phonePreviewForced() ||
    window.matchMedia("(max-width: 700px)").matches
  );
}

export function applyPhoneSettingsClass() {
  document.documentElement.classList.toggle("phone-settings", phoneSettingsLayout());
}

const SETTINGS_TITLES = {
  account: "Account",
  plan: "Plan",
  out: "Out",
  accessibility: "Accessibility",
  feedback: "Feedback",
};

function syncSettingsHomeEmail() {
  const email = signedInSession?.user?.email || "";
  document.querySelectorAll("#signed-in-email, [data-settings-home-email]").forEach((el) => {
    el.textContent = email;
  });
}

let settingsTab = "account";

function showSettingsHome() {
  applyPhoneSettingsClass();
  const home = document.querySelector("[data-settings-home]");
  const back = document.querySelector("[data-settings-back]");
  const title = document.querySelector("#settings-title");
  if (home) home.hidden = false;
  if (back) back.hidden = true;
  if (title) title.textContent = "Settings";
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.hidden = true;
  });
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.remove("on");
  });
  syncSettingsHomeEmail();
}

export function showSettingsTab(id) {
  const tab = allowedSettingsTab(id);
  settingsTab = tab;
  const stacked = phoneSettingsLayout() && !passwordChangeNeeded();
  applyPhoneSettingsClass();
  const home = document.querySelector("[data-settings-home]");
  const back = document.querySelector("[data-settings-back]");
  const title = document.querySelector("#settings-title");
  if (home) home.hidden = true;
  if (stacked) {
    if (back) back.hidden = false;
    if (title) title.textContent = SETTINGS_TITLES[tab] || "Settings";
  } else {
    if (back) back.hidden = true;
    if (title) title.textContent = "Settings";
  }
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.toggle("on", button.dataset.settingsTab === tab);
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== tab;
  });
  if (tab === "feedback") renderTutorFeedbackInbox();
}

export function passwordChangeNeeded() {
  return needsPasswordChange(signedInSession);
}

function passwordFormFields() {
  return {
    form: document.querySelector("#settings-password-form"),
    next: document.querySelector("#settings-password-new"),
    confirm: document.querySelector("#settings-password-confirm"),
  };
}

function syncPasswordMatch() {
  const { next, confirm } = passwordFormFields();
  const match = Boolean(next?.value && confirm?.value && next.value === confirm.value);
  next?.classList.toggle("is-match", match);
  confirm?.classList.toggle("is-match", match);
}

function resetPasswordForm() {
  const { form, next, confirm } = passwordFormFields();
  form?.reset();
  next?.classList.remove("is-match");
  confirm?.classList.remove("is-match");
  setPasswordFormMessage();
}

function setPasswordFormMessage(error = "", ok = "") {
  const errorEl = document.querySelector("#settings-password-error");
  const okEl = document.querySelector("#settings-password-ok");
  if (errorEl) {
    errorEl.hidden = !error;
    errorEl.textContent = error;
  }
  if (okEl) {
    okEl.hidden = !ok;
    okEl.textContent = ok;
  }
}

const PASSWORD_LOCK_INERT = [".app-shell", "#reports-modal", "#report-view"];

function syncPasswordLockSurfaces(locked) {
  PASSWORD_LOCK_INERT.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.inert = locked;
      if (locked) el.setAttribute("aria-hidden", "true");
      else el.removeAttribute("aria-hidden");
    });
  });
  document.querySelectorAll("[data-settings-close]").forEach((el) => {
    const backdrop = el.classList.contains("settings-modal-backdrop");
    el.hidden = locked && !backdrop;
    if ("disabled" in el) el.disabled = locked;
    el.tabIndex = locked ? -1 : 0;
  });
  document.querySelectorAll("[data-settings-tab]").forEach((el) => {
    const blocked = el.dataset.settingsTab === "plan" || el.dataset.settingsTab === "out";
    el.disabled = locked && blocked;
  });
}

export function applyPasswordLock({ keepTab = false } = {}) {
  const locked = passwordChangeNeeded();
  document.body.classList.toggle("password-lock", locked);
  document.querySelectorAll("[data-password-lock-copy]").forEach((el) => {
    el.hidden = !locked;
  });
  syncPasswordLockSurfaces(locked);
  if (!locked) return;
  if (!keepTab) showSettingsTab("account");
  openAccountSettings();
}

export function forcePasswordChange() {
  if (!passwordChangeNeeded()) return false;
  applyPasswordLock({ keepTab: false });
  document.querySelector("#settings-password-current")?.focus();
  return true;
}

async function handlePasswordChange(event) {
  event.preventDefault();
  setPasswordFormMessage();
  const current = document.querySelector("#settings-password-current")?.value || "";
  const next = document.querySelector("#settings-password-new")?.value || "";
  const confirm = document.querySelector("#settings-password-confirm")?.value || "";
  const submit = document.querySelector("#settings-password-save");
  if (next !== confirm) {
    setPasswordFormMessage("The new passwords do not match.");
    return;
  }
  if (submit) submit.disabled = true;
  try {
    const user = await changePassword(current, next);
    if (signedInSession) signedInSession = { ...signedInSession, user };
    resetPasswordForm();
    setPasswordFormMessage("", "Your password has been updated.");
    applyPasswordLock();
  } catch (error) {
    setPasswordFormMessage(error.message || "Could not update the password.");
  } finally {
    if (submit) submit.disabled = false;
  }
}

function isPasswordLockAllowed(target) {
  return Boolean(
    target.closest("#login-form") ||
      (target.closest("[data-settings-card]") && !target.closest("[data-settings-close]")),
  );
}

function guardPasswordLock(event) {
  if (!passwordChangeNeeded()) return false;
  if (isPasswordLockAllowed(event.target)) return false;
  if (event.type === "keydown" && event.key === "Tab" && event.target.closest("[data-settings-card]")) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  forcePasswordChange();
  return true;
}

export function openAccountSettings() {
  const modal = document.querySelector("[data-settings-modal]");
  if (!modal) return;
  modal.hidden = false;
  document.querySelector("#account-settings")?.setAttribute("aria-expanded", "true");
  document.body.classList.add("settings-open");
  applyAppearance();
  if (passwordChangeNeeded()) showSettingsTab("account");
  else if (phoneSettingsLayout()) showSettingsHome();
  else showSettingsTab(settingsTab || "account");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("open"));
  });
}

export function closeAccountSettings({ force = false } = {}) {
  if (!force && passwordChangeNeeded()) {
    forcePasswordChange();
    return;
  }
  resetPasswordForm();
  const modal = document.querySelector("[data-settings-modal]");
  modal?.classList.remove("open");
  document.querySelector("#account-settings")?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("settings-open");
  setTimeout(() => {
    if (modal && !modal.classList.contains("open")) modal.hidden = true;
  }, 420);
}

applyAppearance();

export function applyTutorShell() {
  document.body.classList.toggle("tutor-only", tutorMode);
  document.body.classList.toggle("office-only", officeMode);
  applyPhoneOutMode({ route: false });
  if (ledeReviews) ledeReviews.hidden = true;
  const reviewsIntro = document.querySelector("#reviews-intro");
  if (reviewsIntro) {
    reviewsIntro.hidden = !tutorMode;
    reviewsIntro.textContent = tutorMode
      ? "Your learners are listed by due date. A review can be filled from two weeks before it is due."
      : "";
  }
  if (reviewsSearch) {
    reviewsSearch.placeholder = tutorMode
      ? "Search a name, company or postcode"
      : "Search a name, tutor, company or postcode";
  }
}

// applySignedInSession is the old setSignedIn: it records who is signed in
// and opens or closes the password lock with that account.
export function applySignedInSession(session) {
  signedInSession = session || null;
  tutorMode = isTutorSession(signedInSession);
  adminMode = !tutorMode && isAdminSession(signedInSession);
  officeMode = !tutorMode && !adminMode && isOfficeSession(signedInSession);
  document.body.classList.toggle("signed-out", !session);
  applyTutorShell();
  syncSettingsHomeEmail();
  applyPasswordLock();
  if (!session) closeAccountSettings({ force: true });
}

export const setSignedIn = applySignedInSession;

async function handleSignIn(event) {
  event.preventDefault();
  showLoginError("");
  const email = document.querySelector("#login-email")?.value || "";
  const password = document.querySelector("#login-password")?.value || "";
  const remember = Boolean(document.querySelector("#login-remember")?.checked);
  const submit = document.querySelector("#login-submit");
  if (submit) submit.disabled = true;
  try {
    await signIn(email, password, remember);
  } catch (error) {
    showLoginError(error.message || "Could not sign in.");
  } finally {
    if (submit) submit.disabled = false;
  }
}
