import { mkdirSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionsPage,
  AddCandidate,
  CalendarPage,
  CandidateRecord,
  CandidatesList,
  DuePage,
  EmployerRecord,
  EmployersPage,
  InductionsPage,
  InterviewsPage,
  OverviewPage,
  ReportsPage,
  VacanciesPage,
} from "./views";

const props = {
  base: "/administration/onboarding",
  example: true,
  missing: false,
  error: null,
  query: "",
};

const pages: Array<[string, React.ReactElement]> = [
  ["01-candidates-list", createElement(CandidatesList, props)],
  ["02-candidate-record", createElement(CandidateRecord, props)],
  ["03-add-candidate", createElement(AddCandidate, props)],
  ["04-interviews", createElement(InterviewsPage, props)],
  ["05-overview", createElement(OverviewPage, props)],
  ["06-employers-list", createElement(EmployersPage, props)],
  ["06b-vacancies-list", createElement(VacanciesPage, props)],
  ["07-employer-record", createElement(EmployerRecord, { ...props, employer: "Northbridge Motors" })],
  ["08-activity-calendar", createElement(CalendarPage, props)],
  ["09-actions", createElement(ActionsPage, props)],
  ["10-reports", createElement(ReportsPage, props)],
  ["11-due-for-review", createElement(DuePage, { ...props, confirmName: null })],
  ["11b-delete-confirm", createElement(DuePage, { ...props, confirmName: "Amira Khan" })],
  ["12-inductions", createElement(InductionsPage, props)],
];

describe("candidate preview shots", () => {
  it("writes example HTML for visual comparison", () => {
    const dir = "/tmp/candidate-shots";
    mkdirSync(dir, { recursive: true });
    const css = "/agent/repos/GTA-Portal/docs/candidates-preview/styles.css";
    for (const [name, element] of pages) {
      const body = renderToStaticMarkup(element);
      writeFileSync(
        `${dir}/${name}.html`,
        `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head><body style="width:1280px;margin:0"><div class="content" style="width:992px">${body}</div></body></html>`,
      );
    }
    expect(pages.length).toBe(14);
  });
});
