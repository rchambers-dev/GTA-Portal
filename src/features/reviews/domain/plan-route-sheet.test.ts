import { describe, expect, it } from "vitest";
import { comparePlanNotes } from "./plan-notes";
import type { PlanPageData, PlanStop } from "./plan-repository";
import { buildRouteEmail, buildRoutePrintHtml, DEFAULT_ROUTE_EMAIL } from "./plan-route-sheet";

function stop(partial: Partial<PlanStop> & Pick<PlanStop, "gtaId" | "name" | "kind">): PlanStop {
  return {
    company: "Yard",
    postcode: "DN1 1AA",
    phone: "01709 000000",
    contact: "Pat Manager",
    releaseDay: "Thursday",
    appointmentOn: null,
    sortOrder: 0,
    verified: false,
    completed: false,
    accepted: false,
    arrive: "10:20",
    leave: "10:50",
    arriveMinutes: 10 * 60 + 20,
    leaveMinutes: 10 * 60 + 50,
    locked: false,
    dueLabel: "On track",
    dueState: "ok",
    tutor: "Alex Tutor",
    safeguarding: false,
    signoffId: null,
    reviewId: null,
    notes: "",
    notesUntil: "",
    method: "in_person",
    ...partial,
  };
}

const page = {
  settings: { officePostcode: "DN3 3DY", startTime: "10:00", extraEmails: ["office@gta.ac.uk", DEFAULT_ROUTE_EMAIL] },
} as PlanPageData;

describe("plan notes order", () => {
  it("puts notes that need checking first, then by end date and name", () => {
    const rows = [
      { notesUntil: "2026-11-23", name: "Sam" },
      { notesUntil: "2026-11-10", name: "Bea" },
      { notesUntil: "2026-11-17", name: "Ada" },
    ].sort((a, b) => comparePlanNotes(a, b, "2026-11-13"));
    expect(rows.map((row) => row.name)).toEqual(["Bea", "Ada", "Sam"]);
  });
});

describe("route email and print", () => {
  const stops = [
    stop({ gtaId: "phone", name: "Phone Learner", kind: "phone", method: "phone" }),
    stop({ gtaId: "visit", name: "Visit Learner", kind: "visit" }),
  ];

  it("matches the Review Assistant email order and addresses", () => {
    const email = buildRouteEmail(page, stops, "2026-11-16", null);
    expect(email.subject).toBe("Monday 16 Nov review round");
    expect(email.href.startsWith(`mailto:${DEFAULT_ROUTE_EMAIL},office@gta.ac.uk?`)).toBe(true);
    expect(email.body).toContain("Google Maps route:");
    expect(email.body).toContain("https://www.google.com/maps/dir/DN3%203DY/DN1%201AA/DN3%203DY");
    expect(email.body.indexOf("Phone Phone Learner")).toBeLessThan(email.body.indexOf("1. Visit Learner"));
    expect(email.body).toContain("Leave office DN3 3DY at 10:00");
    expect(email.body).toContain("arrive 10:20, leave 10:50");
    expect(email.body).toContain("Back at office");
  });

  it("prints phone calls before visits, with tutor and workplace details, in dark text on white", () => {
    const html = buildRoutePrintHtml(page, stops, "2026-11-16", { driveTotal: 75, leaveMinutes: 10 * 60, returnArrive: 15 * 60 + 10, stops: [], returnTravel: 0, callStart: 0, callEnd: 0 });
    expect(html).toContain("background:#fff");
    expect(html).toContain("color:#111");
    expect(html.indexOf("Phone · Phone Learner")).toBeLessThan(html.indexOf("1. Visit Learner"));
    expect(html).toContain("college Thursday");
    expect(html).toContain("contact Pat Manager");
    expect(html).toContain("Tutor Alex Tutor");
    expect(html).toContain("1 hr 15 min driving");
    expect(html).toContain("Monday 16 Nov workplace review round");
  });
});
