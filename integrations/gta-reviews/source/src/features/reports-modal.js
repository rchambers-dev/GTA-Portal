import {
  analyticsReportViewHtml,
  analyticsReportsEmailText,
  earliestReviewDateKey,
  inProgressReportPeriods,
  reportIsFinished,
  reportsToEmail,
} from "../analytics.js";
import {
  reportsAutoEmail,
  reportsList,
  reportsModal,
  reportsNext,
} from "../app/dom.js";
import { scheduleStateSave } from "../app/persist.js";
import { routeMailtoHref } from "../lib/format.js";
import { escapeHtml } from "../lib/html.js";
import { DEFAULT_ROUTE_EMAIL, formatUkDateKey } from "../planner.js";

let reportsTab = "saved";
let openReportId = "";
let hooks = null;

export function bindReportsModal(next) {
  hooks = next;
}

function reportUnboundModal() {
  console.error("Failed to update reports:", "reports modal callbacks are not bound.");
}

function appState() {
  if (!hooks?.getState) {
    reportUnboundModal();
    return { settings: {}, analyticsReports: [] };
  }
  return hooks.getState();
}

function setReportStatus(message) {
  if (!hooks?.setStatus) {
    reportUnboundModal();
    return;
  }
  hooks.setStatus(message);
}

export function closeReportsModal() {
  if (!reportsModal || reportsModal.hidden) return;
  reportsModal.classList.remove("open");
  document.querySelector("#analytics-reports-btn")?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("settings-open");
  setTimeout(() => {
    if (!reportsModal.classList.contains("open")) reportsModal.hidden = true;
  }, 420);
}

function openReportsModal() {
  if (!reportsModal) return;
  renderReportsModal();
  reportsModal.hidden = false;
  document.querySelector("#analytics-reports-btn")?.setAttribute("aria-expanded", "true");
  document.body.classList.add("settings-open");
  requestAnimationFrame(() => reportsModal.classList.add("open"));
}

function showReportsTab(tab) {
  reportsTab = tab === "settings" || tab === "next" ? tab : "saved";
  reportsModal?.querySelectorAll("[data-reports-tab]").forEach((button) => {
    const on = button.dataset.reportsTab === reportsTab;
    button.classList.toggle("on", on);
  });
  reportsModal?.querySelectorAll("[data-reports-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.reportsPanel !== reportsTab;
  });
}

function findStoredReport(id) {
  return (appState().analyticsReports || []).find((item) => item.id === id) || null;
}

function reportNotReadyStatus(report) {
  return `${report?.label || "That report"} is not finished yet. Reports end on the last Friday of the period.`;
}

function reportsItemHtml(report) {
  const summary = report.summary || {};
  const finished = reportIsFinished(report);
  const emailed = report.emailedAt ? "Emailed" : "Not emailed";
  return `
    <article class="reports-item">
      <div>
        <strong>${escapeHtml(report.label)}</strong>
        <p class="meta">${escapeHtml(formatUkDateKey(report.startKey))} to ${escapeHtml(formatUkDateKey(report.endKey))}</p>
        <p class="meta">${summary.completed || 0} completed · ${summary.visits || 0} visits · ${summary.calls || 0} calls · ${summary.teams || 0} Teams</p>
        <p class="meta">${escapeHtml(finished ? emailed : "Not finished")}</p>
      </div>
      <div class="reports-item-actions">
        <button type="button" class="btn" data-report-open="${escapeHtml(report.id)}" ${finished ? "" : "disabled"}>Open</button>
        <button type="button" class="btn" data-report-email="${escapeHtml(report.id)}" ${finished ? "" : "disabled"}>Email</button>
      </div>
    </article>
  `;
}

function renderReportsModal() {
  const state = appState();
  if (reportsAutoEmail) reportsAutoEmail.checked = state.settings.reportAutoEmail !== false;
  if (reportsNext) {
    const upcoming = inProgressReportPeriods(new Date(), {
      sinceKey: earliestReviewDateKey(state),
    });
    reportsNext.innerHTML = upcoming.length
      ? upcoming
          .map(
            (item) => `
          <article class="reports-next-item">
            <strong>${escapeHtml(item.label)}</strong>
            <p class="meta">Ready on Friday ${escapeHtml(formatUkDateKey(item.availableFrom))}</p>
          </article>
        `,
          )
          .join("")
      : `<p class="empty">No upcoming reports yet.</p>`;
  }
  if (reportsList) {
    const reports = state.analyticsReports || [];
    reportsList.innerHTML = reports.length
      ? reports.map(reportsItemHtml).join("")
      : `<p class="empty">Reports appear here once a month, quarter or year has finished on its last Friday.</p>`;
  }
  showReportsTab(reportsTab);
}

export function closeStoredReportView() {
  const dialog = document.querySelector("#report-view");
  const frame = document.querySelector("#report-view-frame");
  openReportId = "";
  if (!dialog?.open) return false;
  dialog.close();
  if (frame) frame.srcdoc = "";
  return true;
}

function openStoredReport(report) {
  if (!reportIsFinished(report)) {
    setReportStatus(reportNotReadyStatus(report));
    return;
  }
  const dialog = document.querySelector("#report-view");
  const frame = document.querySelector("#report-view-frame");
  const title = document.querySelector("#report-view-title");
  const printBtn = document.querySelector("#report-view-print");
  if (!dialog || !frame) return;
  openReportId = report.id;
  if (title) title.textContent = report.label;
  if (printBtn) printBtn.disabled = false;
  frame.srcdoc = analyticsReportViewHtml(report.html);
  if (typeof dialog.showModal === "function") dialog.showModal();
}

function emailStoredReports(reports, { statusText } = {}) {
  const state = appState();
  const list = (reports || []).filter((item) => reportIsFinished(item));
  if (!list.length) {
    setReportStatus("That report is not finished yet, so it cannot be emailed.");
    return false;
  }
  window.location.href = routeMailtoHref(
    list.length === 1
      ? `Review Assistant report: ${list[0].label}`
      : `Review Assistant reports: ${list.map((item) => item.label).join(", ")}`,
    analyticsReportsEmailText(list),
    state.settings.email,
  );
  const emailedAt = new Date().toISOString();
  for (const report of list) report.emailedAt = emailedAt;
  scheduleStateSave();
  renderReportsModal();
  setReportStatus(statusText || `Opened an email to ${DEFAULT_ROUTE_EMAIL} with the ${list[0].label} report.`);
  return true;
}

export function maybeEmailNewReports(created) {
  const state = appState();
  if (state.settings.reportAutoEmail === false) return;
  const due = reportsToEmail(created);
  if (!due.length) return;
  emailStoredReports(due, {
    statusText: `Opened an email to ${DEFAULT_ROUTE_EMAIL} with ${
      due.length === 1 ? `the ${due[0].label} report` : `${due.length} new reports`
    }.`,
  });
}

export function mountReportsModal() {
  document.querySelector("#report-view-close")?.addEventListener("click", () => {
    closeStoredReportView();
  });

  document.querySelector("#report-view-print")?.addEventListener("click", () => {
    const report = findStoredReport(openReportId);
    if (!reportIsFinished(report)) {
      setReportStatus(reportNotReadyStatus(report || { label: "That report" }));
      return;
    }
    document.querySelector("#report-view-frame")?.contentWindow?.print();
  });

  document.querySelector("#report-view")?.addEventListener("close", () => {
    const frame = document.querySelector("#report-view-frame");
    if (frame) frame.srcdoc = "";
  });

  document.querySelector("#analytics-reports-btn")?.addEventListener("click", () => {
    openReportsModal();
  });

  reportsModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-reports-close]")) {
      closeReportsModal();
      return;
    }
    const tab = event.target.closest("[data-reports-tab]");
    if (tab) {
      showReportsTab(tab.dataset.reportsTab);
      return;
    }
    const openBtn = event.target.closest("[data-report-open]");
    if (openBtn) {
      const report = findStoredReport(openBtn.dataset.reportOpen);
      if (!reportIsFinished(report)) {
        setReportStatus(reportNotReadyStatus(report));
        return;
      }
      if (report) openStoredReport(report);
      return;
    }
    const emailBtn = event.target.closest("[data-report-email]");
    if (emailBtn) {
      const report = findStoredReport(emailBtn.dataset.reportEmail);
      if (!reportIsFinished(report)) {
        setReportStatus(reportNotReadyStatus(report));
        return;
      }
      emailStoredReports([report]);
    }
  });

  reportsAutoEmail?.addEventListener("change", () => {
    appState().settings.reportAutoEmail = reportsAutoEmail.checked;
    scheduleStateSave();
  });
}
