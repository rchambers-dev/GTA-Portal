import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/capabilities";
import type { EffectiveSession } from "@/lib/portal/types";
import { canManageOpenDays } from "./domain/access";
import { activeBookingCounts, bookingsToCsv, filterBookings } from "./domain/bookings";
import { EXAMPLE_CENTRES, exampleBookingsFor, exampleOpenDay, exampleOpenDays } from "./domain/example";
import { openDaysFeatureOff, TABLES_BANNER, tablesMissing } from "./domain/missing";
import { isoToLondonLocal, londonLocalToIso } from "./domain/time";
import { formFromOpenDay, validateOpenDay } from "./domain/validate";
import { OpenDayDetail } from "./screens/OpenDayDetail";
import { OpenDayForm } from "./screens/OpenDayForm";
import { OpenDaysList } from "./screens/OpenDaysList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

function actor(role: string, permissions: string[]): EffectiveSession {
  return {
    account: {
      id: "staff",
      name: "Staff Example",
      initials: "SE",
      email: "staff@example.test",
      baseRole: role,
      responsibilities: [],
      workspace: role === "Management" ? "management" : "administration",
      permissions,
    },
    permissions,
    activeTemporaryAssignments: [],
    temporaryAccessLabels: [],
  };
}

const exampleMode = {
  example: true,
  banner: TABLES_BANNER,
  savingMessage: "Saving is disabled until the Open Days tables are created.",
  error: null,
};

describe("open days access and fallback", () => {
  it("allows Administrator and Management with records access, and refuses tutors", () => {
    expect(canManageOpenDays(actor("Administrator", [PERMISSIONS.ADMIN_RECORDS_MANAGE]))).toBe(true);
    expect(canManageOpenDays(actor("Management", [PERMISSIONS.ADMIN_RECORDS_MANAGE]))).toBe(true);
    expect(canManageOpenDays(actor("Tutor", [PERMISSIONS.ADMIN_RECORDS_MANAGE]))).toBe(false);
    expect(canManageOpenDays(actor("Administrator", []))).toBe(false);
    expect(canManageOpenDays(null)).toBe(false);
  });

  it("treats a missing table or an off switch as example mode", () => {
    expect(tablesMissing("Could not find the table 'public.open_days' in the schema cache", "PGRST205")).toBe(true);
    expect(tablesMissing("relation \"open_days\" does not exist", "42P01")).toBe(true);
    expect(tablesMissing("permission denied", "42501")).toBe(false);
    expect(openDaysFeatureOff({ OPEN_DAYS_ENABLED: "off" })).toBe(true);
    expect(openDaysFeatureOff({ OPEN_DAYS_ENABLED: "false" })).toBe(true);
    expect(openDaysFeatureOff({ NEXT_PUBLIC_OPEN_DAYS_ENABLED: "0" })).toBe(true);
    expect(openDaysFeatureOff({})).toBe(false);
    expect(openDaysFeatureOff({ OPEN_DAYS_ENABLED: "1" })).toBe(false);
  });

  it("is wired into both Marketing workspaces", () => {
    const routes = readFileSync(path.join(process.cwd(), "src/shell/workspaces/render-workspace-page.tsx"), "utf8");
    expect(routes).toContain("OpenDaysArea");
    expect(routes).toContain('segment.startsWith("marketing/open-days/")');
    const nav = readFileSync(path.join(process.cwd(), "src/shell/workspaces/resolve-navigation.ts"), "utf8");
    expect(nav).toContain('label: "Open days"');
    expect(nav).toContain("`${base}/open-days`");
    const migration = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261117120000_open_days.sql"),
      "utf8",
    );
    expect(migration).toContain("create table public.open_days");
    expect(migration).toContain("create table public.open_day_bookings");
    expect(migration).toContain("create table public.open_day_booking_vehicles");
    expect(migration).toContain("Not applied");
    expect(migration.toLowerCase()).not.toContain("parking");
    const drawerCss = readFileSync(
      path.join(process.cwd(), "src/features/open-days/screens/open-days.module.css"),
      "utf8",
    );
    expect(drawerCss).toContain("top: calc(var(--header-height) + var(--space-3))");
    expect(drawerCss).toContain("max-height: calc(100dvh - var(--header-height) - var(--space-3))");
    const drawer = readFileSync(
      path.join(process.cwd(), "src/features/open-days/screens/OpenDayDetail.tsx"),
      "utf8",
    );
    expect(drawer).toContain("createPortal");
    expect(drawer).toContain("document.body");
  });
});

describe("open day form rules", () => {
  const blank = formFromOpenDay(null, EXAMPLE_CENTRES);

  it("accepts a centre event and rejects a reversed time and a bad image address", () => {
    const ok = validateOpenDay(
      {
        ...blank,
        title: "Summer open day",
        dateOn: "2026-08-15",
        startTime: "10:00",
        endTime: "15:00",
        locationMode: "centre",
        centreId: "example-centre-doncaster",
        heroImageUrl: "https://example.test/hero.jpg",
        capacityTradeStands: "12",
      },
      EXAMPLE_CENTRES,
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.slug).toBe("summer-open-day-2026-08-15");
      expect(ok.value.centreId).toBe("example-centre-doncaster");
      expect(ok.value.locationName).toBeNull();
      expect(ok.value.capacityTradeStands).toBe(12);
    }

    const reversed = validateOpenDay(
      { ...blank, title: "Summer", dateOn: "2026-08-15", startTime: "15:00", endTime: "10:00", centreId: "example-centre-doncaster" },
      EXAMPLE_CENTRES,
    );
    expect(reversed.ok).toBe(false);
    if (!reversed.ok) expect(reversed.fieldErrors.endTime).toMatch(/after/i);

    const image = validateOpenDay(
      { ...blank, title: "Summer", dateOn: "2026-08-15", centreId: "example-centre-doncaster", heroImageUrl: "not a url" },
      EXAMPLE_CENTRES,
    );
    expect(image.ok).toBe(false);
  });

  it("requires a location name when the day is not at a centre", () => {
    const missing = validateOpenDay(
      { ...blank, title: "Taster", dateOn: "2026-09-12", locationMode: "other", locationName: "  " },
      EXAMPLE_CENTRES,
    );
    expect(missing.ok).toBe(false);
    const named = validateOpenDay(
      {
        ...blank,
        title: "Taster",
        dateOn: "2026-09-12",
        locationMode: "other",
        locationName: "Sheffield City Centre",
        address: "Example Street, Sheffield S1 1AA",
      },
      EXAMPLE_CENTRES,
    );
    expect(named.ok).toBe(true);
    if (named.ok) expect(named.value.centreId).toBeNull();
  });

  it("keeps booking windows in Europe/London", () => {
    expect(londonLocalToIso("2026-01-15T10:00")).toBe("2026-01-15T10:00:00.000Z");
    expect(londonLocalToIso("2026-08-15T10:00")).toBe("2026-08-15T09:00:00.000Z");
    expect(isoToLondonLocal("2026-08-15T09:00:00.000Z")).toBe("2026-08-15T10:00");
  });
});

describe("open day bookings", () => {
  const summer = exampleOpenDay("example-open-day-summer");
  const bookings = exampleBookingsFor("example-open-day-summer");

  it("counts active exhibitor and trade stand bookings and ignores cancelled rows", () => {
    expect(summer?.exhibitorCount).toBe(3);
    expect(summer?.tradeStandCount).toBe(2);
    expect(activeBookingCounts(bookings)).toEqual({ exhibitors: 3, tradeStands: 2 });
  });

  it("filters by type, status and search, and exports the visible columns", () => {
    const stands = filterBookings(bookings, { tab: "trade_stand", query: "northbridge", status: "all" });
    expect(stands.map((row) => row.companyName)).toEqual(["Northbridge Motors"]);
    const checked = filterBookings(bookings, { tab: "exhibitor", query: "", status: "checked_in" });
    expect(checked.map((row) => row.lastName)).toEqual(["Blake"]);
    const csv = bookingsToCsv(stands);
    expect(csv).toContain("Northbridge Motors");
    expect(csv).toContain("1 vehicle, 6×3 m");
    expect(csv).toContain("Insurance confirmed");
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});

describe("open days screens", () => {
  const days = exampleOpenDays();
  const summer = days.find((day) => day.id === "example-open-day-summer");

  it("renders the list, form and bookings table with the example banner", () => {
    expect(summer).toBeTruthy();
    const list = renderToStaticMarkup(
      createElement(OpenDaysList, { workspace: "administration", days, mode: exampleMode }),
    );
    expect(list).toContain(TABLES_BANNER);
    expect(list).toContain("Summer open day");
    expect(list).toContain("Published");
    expect(list).toContain("Bookings open");
    expect(list).toContain("3 exhibitor bookings");
    expect(list).toContain("2 trade stand bookings");
    expect(list).toContain('href="/administration/marketing/open-days/new"');
    expect(list).toContain("New open day");
    expect(list).not.toContain("parking");

    const form = renderToStaticMarkup(
      createElement(OpenDayForm, {
        workspace: "management",
        day: summer!,
        centres: EXAMPLE_CENTRES,
        mode: exampleMode,
      }),
    );
    expect(form).toContain(TABLES_BANNER);
    expect(form).toContain("Saving is disabled until the Open Days tables are created.");
    expect(form).toContain("Trade stand capacity");
    expect(form).toContain("Doncaster");
    expect(form).toContain("disabled");
    expect(form).toContain('href="/management/marketing/open-days/example-open-day-summer"');

    const detail = renderToStaticMarkup(
      createElement(OpenDayDetail, {
        workspace: "administration",
        day: summer!,
        bookings: exampleBookingsFor(summer!.id),
        mode: exampleMode,
      }),
    );
    expect(detail).toContain("Alex Morgan");
    expect(detail).toContain("alex.morgan@example.test");
    expect(detail).toContain("ABC123A");
    expect(detail).toContain("Northbridge Motors");
    expect(detail).toContain("Body repair");
    expect(detail).toContain("Checked in");
    expect(detail).toContain("Export CSV");
    expect(detail).toContain("Exhibitors");
    expect(detail).toContain("Trade stands");
  });
});
